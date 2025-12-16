import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { searchParams } = new URL(request.url)
    
    // Parse filters
    const status = searchParams.get('status')
    const assetId = searchParams.get('assetId')
    const category = searchParams.get('category')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const skip = (page - 1) * pageSize

    // Build where clause
    const whereClause: Prisma.AssetsMaintenanceWhereInput = {}

    // Apply filters
    if (status) {
      whereClause.status = status
    }

    if (assetId) {
      whereClause.assetId = assetId
    }

    // Date range filter
    if (startDate || endDate) {
      whereClause.OR = [
        {
          dueDate: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        },
        {
          createdAt: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        },
      ]
    }

    // Get total count for pagination
    const totalMaintenances = await retryDbOperation(() =>
      prisma.assetsMaintenance.count({
        where: whereClause,
      })
    )
    
    // Get paginated maintenance records
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaClientForMaintenances = prisma as any
    const maintenances = await retryDbOperation(() => prismaClientForMaintenances.assetsMaintenance.findMany({
        where: whereClause,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
              status: true,
              cost: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          inventoryItems: {
            include: {
              inventoryItem: {
                select: {
                  id: true,
                  itemCode: true,
                  name: true,
                  unit: true,
                  unitCost: true,
                },
              },
            },
          },
        },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    }))
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalMaintenances / pageSize)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    // Get ALL maintenances for summary calculations (no pagination)
    const allMaintenances = await retryDbOperation(() => prismaClientForMaintenances.assetsMaintenance.findMany({
        where: whereClause,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
              status: true,
              cost: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          inventoryItems: {
            include: {
              inventoryItem: {
                select: {
                  id: true,
                  itemCode: true,
                  name: true,
                  unit: true,
                  unitCost: true,
              },
            },
          },
        },
      },
    })) as typeof maintenances

    // Filter by category if needed (for summary)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filteredAllMaintenances: any[] = allMaintenances as any[]
    if (category) {
      filteredAllMaintenances = filteredAllMaintenances.filter(
        (m) => m.asset.category?.id === category
      )
    }

    // Get assets under repair (status: In progress) - from ALL maintenances
    const underRepair = filteredAllMaintenances.filter(
      (m) => m.status === 'In progress'
    )

    // Get upcoming maintenance (Scheduled with dueDate in future) - from ALL maintenances
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const upcomingMaintenance = filteredAllMaintenances.filter((m) => {
      if (m.status !== 'Scheduled') return false
      if (!m.dueDate) return false
      const dueDate = new Date(m.dueDate)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate >= today
    })

    // Get maintenance history (completed) - from ALL maintenances
    const completedMaintenances = filteredAllMaintenances.filter(
      (m) => m.status === 'Completed'
    )
    
    // Get maintenances by status for cost calculations
    const scheduledMaintenances = filteredAllMaintenances.filter((m) => m.status === 'Scheduled')
    const cancelledMaintenances = filteredAllMaintenances.filter((m) => m.status === 'Cancelled')
    const inProgressMaintenances = filteredAllMaintenances.filter((m) => m.status === 'In progress')
    
    // Calculate total costs by status
    const totalCostCompleted = completedMaintenances.reduce((sum, m) => sum + (Number(m.cost) || 0), 0)
    const totalCostScheduled = scheduledMaintenances.reduce((sum, m) => sum + (Number(m.cost) || 0), 0)
    const totalCostCancelled = cancelledMaintenances.reduce((sum, m) => sum + (Number(m.cost) || 0), 0)
    const totalCostInProgress = inProgressMaintenances.reduce((sum, m) => sum + (Number(m.cost) || 0), 0)

    // Group by status - from ALL maintenances
    const byStatus = new Map<string, {
      status: string
      count: number
      totalCost: number
      maintenances: typeof filteredAllMaintenances
    }>()

    filteredAllMaintenances.forEach((maintenance) => {
      const statusKey = maintenance.status || 'Unknown'
      
      if (!byStatus.has(statusKey)) {
        byStatus.set(statusKey, {
          status: statusKey,
          count: 0,
          totalCost: 0,
          maintenances: [],
        })
      }

      const group = byStatus.get(statusKey)!
      group.count++
      // Count cost for all maintenances
      group.totalCost += Number(maintenance.cost) || 0
      group.maintenances.push(maintenance)
    })

    // Calculate total maintenance costs - only from COMPLETED maintenances
    const totalCost = completedMaintenances.reduce(
      (sum, m) => sum + (Number(m.cost) || 0),
      0
    )

    // Calculate average cost per maintenance - only from COMPLETED maintenances
    const averageCost =
      completedMaintenances.length > 0
        ? totalCost / completedMaintenances.length
        : 0

    // Sort upcoming by due date
    const sortedUpcoming = [...upcomingMaintenance].sort((a, b) => {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })

    // Filter paginated maintenances by category if needed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filteredMaintenances: any[] = maintenances as any[]
    if (category) {
      filteredMaintenances = filteredMaintenances.filter(
        (m) => m.asset.category?.id === category
      )
    }

    return NextResponse.json({
      summary: {
        totalMaintenances: filteredAllMaintenances.length,
        underRepair: underRepair.length,
        upcoming: upcomingMaintenance.length,
        completed: completedMaintenances.length,
        totalCost: totalCost,
        averageCost: averageCost,
        totalCostByStatus: {
          completed: totalCostCompleted,
          scheduled: totalCostScheduled,
          cancelled: totalCostCancelled,
          inProgress: totalCostInProgress,
        },
        byStatus: Array.from(byStatus.values()).map((group) => ({
          status: group.status,
          count: group.count,
          totalCost: group.totalCost,
          averageCost: group.count > 0 ? group.totalCost / group.count : 0,
        })),
      },
      maintenances: filteredMaintenances.map((maintenance) => ({
        id: maintenance.id,
        assetId: maintenance.assetId,
        assetTagId: maintenance.asset.assetTagId,
        assetDescription: maintenance.asset.description,
        assetStatus: maintenance.asset.status,
        assetCost: maintenance.asset.cost ? Number(maintenance.asset.cost) : null,
        category: maintenance.asset.category?.name || null,
        title: maintenance.title,
        details: maintenance.details,
        status: maintenance.status,
        dueDate: maintenance.dueDate
          ? maintenance.dueDate.toISOString().split('T')[0]
          : null,
        dateCompleted: maintenance.dateCompleted
          ? maintenance.dateCompleted.toISOString().split('T')[0]
          : null,
        dateCancelled: maintenance.dateCancelled
          ? maintenance.dateCancelled.toISOString().split('T')[0]
          : null,
        maintenanceBy: maintenance.maintenanceBy,
        cost: maintenance.cost ? Number(maintenance.cost) : null,
        isRepeating: maintenance.isRepeating,
        isOverdue: maintenance.dueDate
          ? new Date(maintenance.dueDate) < today && maintenance.status === 'Scheduled'
          : false,
        isUpcoming: maintenance.dueDate
          ? new Date(maintenance.dueDate) >= today && maintenance.status === 'Scheduled'
          : false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inventoryItems: maintenance.inventoryItems.map((item: any) => ({
          id: item.id,
          inventoryItemId: item.inventoryItemId,
          quantity: Number(item.quantity),
          unitCost: item.unitCost ? Number(item.unitCost) : null,
          inventoryItem: {
            id: item.inventoryItem.id,
            itemCode: item.inventoryItem.itemCode,
            name: item.inventoryItem.name,
            unit: item.inventoryItem.unit,
            unitCost: item.inventoryItem.unitCost ? Number(item.inventoryItem.unitCost) : null,
          },
        })),
      })),
      upcoming: sortedUpcoming.slice(0, 20).map((maintenance) => ({
        id: maintenance.id,
        assetId: maintenance.assetId,
        assetTagId: maintenance.asset.assetTagId,
        assetDescription: maintenance.asset.description,
        title: maintenance.title,
        dueDate: maintenance.dueDate
          ? maintenance.dueDate.toISOString().split('T')[0]
          : null,
        maintenanceBy: maintenance.maintenanceBy,
        daysUntilDue: maintenance.dueDate
          ? Math.ceil(
              (new Date(maintenance.dueDate).getTime() - today.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null,
      })),
      pagination: {
        page,
        pageSize,
        total: totalMaintenances,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching maintenance report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch maintenance report' },
      { status: 500 }
    )
  }
}

