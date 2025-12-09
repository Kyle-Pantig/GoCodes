import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { parseDate, parseDateTime } from '@/lib/date-utils'
import { requirePermission } from '@/lib/permission-utils'

// PATCH - Update a checkout record (e.g., assign employee)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ checkoutId: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canCheckout')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { checkoutId } = await params
    const body = await request.json()

    // Get user info for history logging
    const userName = auth.user.user_metadata?.name || 
                     auth.user.user_metadata?.full_name || 
                     auth.user.email?.split('@')[0] || 
                     auth.user.email || 
                     auth.user.id

    const updateData: Record<string, unknown> = {}

    if (body.employeeUserId !== undefined) {
      updateData.employeeUserId = body.employeeUserId || null
    }

    if (body.checkoutDate) {
      updateData.checkoutDate = parseDate(body.checkoutDate) || undefined
    }

    if (body.expectedReturnDate !== undefined) {
      updateData.expectedReturnDate = body.expectedReturnDate ? parseDate(body.expectedReturnDate) : null
    }

    // Get current checkout to capture old employee assignment
    const currentCheckout = await prisma.assetsCheckout.findUnique({
      where: { id: checkoutId },
      include: {
        asset: true,
        employeeUser: true,
      },
    })

    if (!currentCheckout) {
      return NextResponse.json(
        { error: 'Checkout record not found' },
        { status: 404 }
      )
    }

    const oldEmployeeUserId = currentCheckout.employeeUserId
    const newEmployeeUserId = body.employeeUserId !== undefined ? (body.employeeUserId || null) : oldEmployeeUserId

    // Update checkout record
    const checkout = await prisma.assetsCheckout.update({
      where: {
        id: checkoutId,
      },
      data: updateData,
      include: {
        asset: true,
        employeeUser: true,
      },
    })

    // Log assignedEmployee change if employee changed
    if (oldEmployeeUserId !== newEmployeeUserId) {
      try {
        // Get employee names for logging
        const oldEmployee = oldEmployeeUserId 
          ? await prisma.employeeUser.findUnique({ where: { id: oldEmployeeUserId } })
          : null
        const newEmployee = newEmployeeUserId
          ? await prisma.employeeUser.findUnique({ where: { id: newEmployeeUserId } })
          : null

        const oldEmployeeName = oldEmployee?.name || oldEmployeeUserId || ''
        const newEmployeeName = newEmployee?.name || newEmployeeUserId || ''

        // Use checkout date or current date for eventDate
        const eventDate = parseDateTime(body.checkoutDate) || checkout.checkoutDate || new Date()

        // Create history log for assignedEmployee change
        await prisma.assetsHistoryLogs.create({
          data: {
            assetId: checkout.assetId,
            eventType: 'edited',
            field: 'assignedEmployee',
            changeFrom: oldEmployeeName,
            changeTo: newEmployeeName,
            actionBy: userName,
            eventDate: eventDate instanceof Date ? eventDate : new Date(eventDate),
          },
        })
      } catch (error) {
        console.error('Error creating assignedEmployee history log:', error)
        // Still try to create log with IDs as fallback
        try {
          await prisma.assetsHistoryLogs.create({
            data: {
              assetId: checkout.assetId,
              eventType: 'edited',
              field: 'assignedEmployee',
              changeFrom: oldEmployeeUserId || '',
              changeTo: newEmployeeUserId || '',
              actionBy: userName,
              eventDate: parseDateTime(body.checkoutDate) || checkout.checkoutDate || new Date(),
            },
          })
        } catch (fallbackError) {
          console.error('Error creating fallback history log:', fallbackError)
          // Don't fail the request if history logging fails
        }
      }
    }

    return NextResponse.json({ checkout })
  } catch (error) {
    console.error('Error updating checkout record:', error)
    return NextResponse.json(
      { error: 'Failed to update checkout record' },
      { status: 500 }
    )
  }
}

// GET - Get a single checkout record
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ checkoutId: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const { checkoutId } = await params

    const checkout = await prisma.assetsCheckout.findUnique({
      where: {
        id: checkoutId,
      },
      include: {
        asset: true,
        employeeUser: true,
        checkins: {
          orderBy: { checkinDate: 'desc' },
          take: 1,
        },
      },
    })

    if (!checkout) {
      return NextResponse.json(
        { error: 'Checkout record not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ checkout })
  } catch (error) {
    console.error('Error fetching checkout record:', error)
    return NextResponse.json(
      { error: 'Failed to fetch checkout record' },
      { status: 500 }
    )
  }
}

