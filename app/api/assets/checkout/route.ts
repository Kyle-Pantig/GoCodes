import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate, parseDateTime } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { clearCache } from '@/lib/cache-utils'

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canCheckout')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const { assetIds, employeeUserId, checkoutDate, expectedReturnDate, updates } = body
    
    // Get user info for history logging - use name from metadata, fallback to email
    const userName = auth.user.user_metadata?.name || 
                     auth.user.user_metadata?.full_name || 
                     auth.user.email?.split('@')[0] || 
                     auth.user.email || 
                     auth.user.id

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json(
        { error: 'Asset IDs are required' },
        { status: 400 }
      )
    }

    if (!employeeUserId) {
      return NextResponse.json(
        { error: 'Employee user ID is required' },
        { status: 400 }
      )
    }

    if (!checkoutDate) {
      return NextResponse.json(
        { error: 'Checkout date is required' },
        { status: 400 }
      )
    }

    // Create checkout records and update assets in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create checkout records for all assets
      const checkoutRecords = await Promise.all(
        assetIds.map(async (assetId: string) => {
          const assetUpdate = updates?.[assetId] || {}
          
          // Get current asset to use current values if not updating
          const currentAsset = await tx.assets.findUnique({
            where: { id: assetId },
          })

          if (!currentAsset) {
            throw new Error(`Asset with ID ${assetId} not found`)
          }

          // Prepare history logs
          const historyLogs: Array<{
            field: string
            changeFrom: string
            changeTo: string
          }> = []

          // Prepare asset update data - update status and location info if provided
          const updateData: Record<string, unknown> = {
            status: "Checked out",
          }

          // Log status change if different from current
          if (currentAsset.status !== "Checked out") {
            historyLogs.push({
              field: 'status',
              changeFrom: currentAsset.status || '',
              changeTo: 'Checked out',
            })
          }

          // Update department/site/location if provided, otherwise keep current values
          const newDepartment = assetUpdate.department !== undefined 
            ? (assetUpdate.department || null)
            : currentAsset?.department
          const newSite = assetUpdate.site !== undefined 
            ? (assetUpdate.site || null)
            : currentAsset?.site
          const newLocation = assetUpdate.location !== undefined 
            ? (assetUpdate.location || null)
            : currentAsset?.location

          updateData.department = newDepartment
          updateData.site = newSite
          updateData.location = newLocation

          // Log location changes if different
          if (newLocation !== currentAsset.location) {
            historyLogs.push({
              field: 'location',
              changeFrom: currentAsset.location || '',
              changeTo: newLocation || '',
            })
          }

          // Log department changes if different
          if (newDepartment !== currentAsset.department) {
            historyLogs.push({
              field: 'department',
              changeFrom: currentAsset.department || '',
              changeTo: newDepartment || '',
            })
          }

          // Log site changes if different
          if (newSite !== currentAsset.site) {
            historyLogs.push({
              field: 'site',
              changeFrom: currentAsset.site || '',
              changeTo: newSite || '',
            })
          }

          // Update asset with new status and location info
          await tx.assets.update({
            where: { id: assetId },
            data: updateData,
          })

          // Log assignedEmployee change (initial assignment)
          if (employeeUserId) {
            try {
              const employee = await tx.employeeUser.findUnique({ where: { id: employeeUserId } })
              const employeeName = employee?.name || employeeUserId // Fallback to ID if name not found
              
              historyLogs.push({
                field: 'assignedEmployee',
                changeFrom: '',
                changeTo: employeeName,
              })
            } catch (error) {
              // If employee lookup fails, still log with employeeUserId as fallback
              console.error('Error fetching employee for history log:', error)
              historyLogs.push({
                field: 'assignedEmployee',
                changeFrom: '',
                changeTo: employeeUserId, // Use ID as fallback
              })
            }
          }

          // Create history logs for checkout
          if (historyLogs.length > 0) {
            const parsedCheckoutDateTime = parseDateTime(checkoutDate) || new Date()
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
                    eventDate: parsedCheckoutDateTime,
                  },
                })
              )
            )
          }

          // Create checkout record (history tracking)
          const checkout = await tx.assetsCheckout.create({
            data: {
              assetId,
              employeeUserId,
              checkoutDate: parseDate(checkoutDate)!,
              expectedReturnDate: expectedReturnDate ? parseDate(expectedReturnDate) : null,
            },
            include: {
              asset: true,
              employeeUser: true,
            },
          })

          return checkout
        })
      )

      return checkoutRecords
    })

    // Invalidate dashboard and activities cache when checkout is created
    await clearCache('dashboard-stats')
    await clearCache('activities-')
    await clearCache('stats-checkout') // Clear checkout stats cache for real-time updates

    return NextResponse.json({ 
      success: true,
      checkouts: result,
      count: result.length
    })
  } catch (error) {
    console.error('Error creating checkout:', error)
    return NextResponse.json(
      { error: 'Failed to checkout assets' },
      { status: 500 }
    )
  }
}

