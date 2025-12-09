import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { parseDateTime } from '@/lib/date-utils'
import { clearCache } from '@/lib/cache-utils'

// DELETE - Delete a reservation record
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canReserve')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
    
    // Get user info for history logging
    const userName = auth.user.user_metadata?.name || 
                     auth.user.user_metadata?.full_name || 
                     auth.user.email?.split('@')[0] || 
                     auth.user.email || 
                     auth.user.id

    // Delete reservation and update asset status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Check if reservation record exists
      const reservation = await tx.assetsReserve.findUnique({
        where: { id },
        include: {
          asset: true,
        },
      })

      if (!reservation) {
        throw new Error('Reservation record not found')
      }

      const assetId = reservation.assetId

      // Delete the reservation record
      await tx.assetsReserve.delete({
        where: { id },
      })

      // Check if there are any other active reservations for this asset
      const otherReservations = await tx.assetsReserve.count({
        where: {
          assetId,
        },
      })

      // If no other reservations exist and asset status is "Reserved", change it back to "Available"
      if (otherReservations === 0 && reservation.asset.status === "Reserved") {
        await tx.assets.update({
          where: { id: assetId },
          data: {
            status: "Available",
          },
        })

        // Log status change
        await tx.assetsHistoryLogs.create({
          data: {
            assetId,
            eventType: 'edited',
            field: 'status',
            changeFrom: 'Reserved',
            changeTo: 'Available',
            actionBy: userName,
            eventDate: parseDateTime(new Date().toISOString()) || new Date(),
          },
        })
      }

      return { success: true }
    })

    // Invalidate caches
    await clearCache('dashboard-stats')
    await clearCache('activities-')
    await clearCache('stats-reserve')

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error deleting reservation record:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete reservation record' },
      { status: 500 }
    )
  }
}

