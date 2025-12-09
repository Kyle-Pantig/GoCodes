import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate, parseDateTime } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { clearCache } from '@/lib/cache-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check view permission
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('assetId')

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      )
    }

    const reservations = await prisma.assetsReserve.findMany({
      where: {
        assetId,
      },
      include: {
        employeeUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        asset: {
          select: {
            id: true,
            assetTagId: true,
            description: true,
          },
        },
      },
      orderBy: {
        reservationDate: 'desc',
      },
    })

    return NextResponse.json({ reservations })
  } catch (error) {
    console.error('Error fetching reservations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reservations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canReserve')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const { assetId, reservationType, reservationDate, purpose, notes, employeeUserId, department } = body

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      )
    }

    if (!reservationType) {
      return NextResponse.json(
        { error: 'Reservation type is required' },
        { status: 400 }
      )
    }

    if (!reservationDate) {
      return NextResponse.json(
        { error: 'Reservation date is required' },
        { status: 400 }
      )
    }

    // Validate reservation type specific requirements
    if (reservationType === 'Employee' && !employeeUserId) {
      return NextResponse.json(
        { error: 'Employee user is required for Employee reservation' },
        { status: 400 }
      )
    }

    if (reservationType === 'Department' && !department) {
      return NextResponse.json(
        { error: 'Department is required for Department reservation' },
        { status: 400 }
      )
    }

    // Get user info for history logging - use name from metadata, fallback to email
    const userName = auth.user.user_metadata?.name || 
                     auth.user.user_metadata?.full_name || 
                     auth.user.email?.split('@')[0] || 
                     auth.user.email || 
                     auth.user.id

    const parsedReservationDate = parseDateTime(reservationDate)!

    // Create reservation record in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Verify asset exists
      const asset = await tx.assets.findUnique({
        where: { id: assetId },
      })

      if (!asset) {
        throw new Error(`Asset with ID ${assetId} not found`)
      }

      // Prepare history logs
      const historyLogs: Array<{
        field: string
        changeFrom: string
        changeTo: string
      }> = []

      // Update asset status to "Reserved" if not already reserved
      if (asset.status !== "Reserved") {
        await tx.assets.update({
          where: { id: assetId },
          data: {
            status: "Reserved",
          },
        })

        // Log status change
        historyLogs.push({
          field: 'status',
          changeFrom: asset.status || '',
          changeTo: 'Reserved',
        })
      }

      // Create reservation record (history tracking)
      const reservation = await tx.assetsReserve.create({
        data: {
          assetId,
          reservationType,
          reservationDate: parseDate(reservationDate)!,
          purpose: purpose || null,
          notes: notes || null,
          employeeUserId: reservationType === 'Employee' ? employeeUserId : null,
          department: reservationType === 'Department' ? department : null,
        },
        include: {
          asset: true,
          employeeUser: true,
        },
      })

      // Create history logs for status change
      if (historyLogs.length > 0) {
        await Promise.all(
          historyLogs.map((log) =>
            tx.assetsHistoryLogs.create({
              data: {
                assetId,
                eventType: 'edited',
                field: log.field,
                changeFrom: log.changeFrom,
                changeTo: log.changeTo,
                actionBy: userName,
                eventDate: parsedReservationDate,
              },
            })
          )
        )
      }

      return reservation
    })

    // Invalidate dashboard and activities cache when reservation is created
    await clearCache('dashboard-stats')
    await clearCache('activities-')
    await clearCache('stats-reserve') // Clear reserve stats cache for real-time updates

    return NextResponse.json({ 
      success: true,
      reservation: result
    })
  } catch (error) {
    console.error('Error creating reservation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reserve asset' },
      { status: 500 }
    )
  }
}

