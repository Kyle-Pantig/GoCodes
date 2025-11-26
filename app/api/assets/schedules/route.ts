import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { prisma } from '@/lib/prisma'

// Helper function to parse date strings
function parseDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null
  try {
    return new Date(dateString)
  } catch {
    return null
  }
}

// GET - Fetch schedules
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth()
    if (auth.error) return auth.error

    const permissionCheck = await requirePermission('canViewAssets')
    if (!permissionCheck.allowed && permissionCheck.error) {
      return permissionCheck.error
    }

    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('assetId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const scheduleType = searchParams.get('scheduleType')
    const status = searchParams.get('status')

    const where: any = {}

    if (assetId) {
      where.assetId = assetId
    }

    if (startDate || endDate) {
      where.scheduledDate = {}
      if (startDate) {
        where.scheduledDate.gte = parseDate(startDate)
      }
      if (endDate) {
        where.scheduledDate.lte = parseDate(endDate)
      }
    }

    if (scheduleType) {
      where.scheduleType = scheduleType
    }

    if (status) {
      where.status = status
    }

    const schedules = await prisma.assetSchedule.findMany({
      where,
      include: {
        asset: {
          select: {
            id: true,
            assetTagId: true,
            description: true,
            status: true,
          },
        },
      },
      orderBy: {
        scheduledDate: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      schedules,
    })
  } catch (error) {
    console.error('Error fetching schedules:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch schedules',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// POST - Create a new schedule
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth()
    if (auth.error || !auth.user) {
      return auth.error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const permissionCheck = await requirePermission('canEditAssets')
    if (!permissionCheck.allowed && permissionCheck.error) {
      return permissionCheck.error
    }

    const body = await request.json()
    const {
      assetId,
      scheduleType,
      scheduledDate,
      scheduledTime,
      title,
      notes,
      assignedTo,
      location,
      employeeId,
    } = body

    // Validation
    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      )
    }

    if (!scheduleType) {
      return NextResponse.json(
        { error: 'Schedule type is required' },
        { status: 400 }
      )
    }

    const validScheduleTypes = [
      'maintenance',
      'dispose',
      'lease_return',
      'lease',
      'reserve',
      'move',
      'checkin',
      'checkout',
    ]

    if (!validScheduleTypes.includes(scheduleType)) {
      return NextResponse.json(
        { error: 'Invalid schedule type' },
        { status: 400 }
      )
    }

    if (!scheduledDate) {
      return NextResponse.json(
        { error: 'Scheduled date is required' },
        { status: 400 }
      )
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    // Verify asset exists
    const asset = await prisma.assets.findUnique({
      where: { id: assetId },
    })

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // Create schedule
    const schedule = await prisma.assetSchedule.create({
      data: {
        assetId,
        scheduleType,
        scheduledDate: parseDate(scheduledDate)!,
        scheduledTime: scheduledTime || null,
        title,
        notes: notes || null,
        assignedTo: assignedTo || null,
        location: location || null,
        employeeId: employeeId || null,
        status: 'pending',
        createdBy: auth.user.id,
      },
      include: {
        asset: {
          select: {
            id: true,
            assetTagId: true,
            description: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      schedule,
    })
  } catch (error) {
    console.error('Error creating schedule:', error)
    return NextResponse.json(
      {
        error: 'Failed to create schedule',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

