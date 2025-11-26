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

// GET - Get a single schedule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth()
    if (auth.error) return auth.error

    const permissionCheck = await requirePermission('canViewAssets')
    if (!permissionCheck.allowed && permissionCheck.error) {
      return permissionCheck.error
    }

    const { id } = await params

    const schedule = await prisma.assetSchedule.findUnique({
      where: { id },
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
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      schedule,
    })
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch schedule',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// PUT - Update a schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()
    const {
      scheduleType,
      scheduledDate,
      scheduledTime,
      title,
      notes,
      status,
      assignedTo,
      location,
      employeeId,
    } = body

    // Check if schedule exists
    const existingSchedule = await prisma.assetSchedule.findUnique({
      where: { id },
    })

    if (!existingSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {}

    if (scheduleType) {
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
      if (validScheduleTypes.includes(scheduleType)) {
        updateData.scheduleType = scheduleType
      }
    }

    if (scheduledDate) {
      updateData.scheduledDate = parseDate(scheduledDate)!
    }

    if (scheduledTime !== undefined) {
      updateData.scheduledTime = scheduledTime || null
    }

    if (title !== undefined) {
      updateData.title = title
    }

    if (notes !== undefined) {
      updateData.notes = notes || null
    }

    if (status) {
      const validStatuses = ['pending', 'completed', 'cancelled']
      if (validStatuses.includes(status)) {
        updateData.status = status
        
        // Set completion/cancellation timestamps
        if (status === 'completed' && !existingSchedule.completedAt) {
          updateData.completedAt = new Date()
        } else if (status === 'cancelled' && !existingSchedule.cancelledAt) {
          updateData.cancelledAt = new Date()
        }
      }
    }

    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo || null
    }

    if (location !== undefined) {
      updateData.location = location || null
    }

    if (employeeId !== undefined) {
      updateData.employeeId = employeeId || null
    }

    // Update schedule
    const schedule = await prisma.assetSchedule.update({
      where: { id },
      data: updateData,
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
    console.error('Error updating schedule:', error)
    return NextResponse.json(
      {
        error: 'Failed to update schedule',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete a schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth()
    if (auth.error) return auth.error

    const permissionCheck = await requirePermission('canEditAssets')
    if (!permissionCheck.allowed && permissionCheck.error) {
      return permissionCheck.error
    }

    const { id } = await params

    // Check if schedule exists
    const schedule = await prisma.assetSchedule.findUnique({
      where: { id },
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Delete schedule
    await prisma.assetSchedule.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Schedule deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting schedule:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete schedule',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

