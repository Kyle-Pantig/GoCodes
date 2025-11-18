import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    // Get asset value by category
    const assetsByCategory = await prisma.assets.findMany({
      where: {
        isDeleted: false,
      },
      select: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        cost: true,
      },
    })

    // Group by category and sum costs
    const categoryValueMap = new Map<string, { name: string; value: number }>()
    
    assetsByCategory.forEach((asset) => {
      const categoryName = asset.category?.name || 'Uncategorized'
      const categoryId = asset.category?.id || 'uncategorized'
      const cost = asset.cost ? Number(asset.cost) : 0
      
      if (categoryValueMap.has(categoryId)) {
        const existing = categoryValueMap.get(categoryId)!
        existing.value += cost
      } else {
        categoryValueMap.set(categoryId, { name: categoryName, value: cost })
      }
    })

    const assetValueByCategory = Array.from(categoryValueMap.values())
      .sort((a, b) => b.value - a.value)

    // Get summary statistics
    // Total Active Assets (not deleted) - matches assets/list pages count
    const totalActiveAssets = await prisma.assets.count({
      where: {
        isDeleted: false,
      },
    })

    // Get count of checked out assets (not deleted)
    const checkedOutCount = await prisma.assets.count({
      where: {
        isDeleted: false,
        status: {
          equals: 'Checked out',
          mode: 'insensitive',
        },
      },
    })

    // Get count of available assets (not deleted)
    const availableCount = await prisma.assets.count({
      where: {
        isDeleted: false,
        status: {
          equals: 'Available',
          mode: 'insensitive',
        },
      },
    })

    // Calculate total checked out + available
    const checkedOutAndAvailable = checkedOutCount + availableCount

    // Total Value of Assets (sum of all non-deleted asset costs)
    const totalValueResult = await prisma.assets.aggregate({
      where: {
        isDeleted: false,
      },
      _sum: {
        cost: true,
      },
    })
    const totalValue = totalValueResult._sum.cost ? Number(totalValueResult._sum.cost) : 0

    // Purchases in Fiscal Year (assuming fiscal year starts January 1st)
    const now = new Date()
    const fiscalYearStart = new Date(now.getFullYear(), 0, 1) // January 1st of current year
    const fiscalYearEnd = new Date(now.getFullYear() + 1, 0, 1) // January 1st of next year

    const purchasesInFiscalYear = await prisma.assets.count({
      where: {
        isDeleted: false,
        OR: [
          {
            purchaseDate: {
              gte: fiscalYearStart,
              lt: fiscalYearEnd,
            },
          },
          {
            dateAcquired: {
              gte: fiscalYearStart,
              lt: fiscalYearEnd,
            },
          },
        ],
      },
    })

    // Get active checkouts (checked out assets) - latest 10
    const activeCheckouts = await prisma.assetsCheckout.findMany({
      where: {
        checkins: {
          none: {},
        },
      },
      include: {
        asset: {
          select: {
            id: true,
            assetTagId: true,
            description: true,
          },
        },
        employeeUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        checkoutDate: 'desc',
      },
      take: 10,
    })

    // Get recent checkins - latest 10
    const recentCheckins = await prisma.assetsCheckin.findMany({
      include: {
        asset: {
          select: {
            id: true,
            assetTagId: true,
            description: true,
          },
        },
        checkout: {
          include: {
            employeeUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        checkinDate: 'desc',
      },
      take: 10,
    })

    // Get assets under repair/maintenance (Scheduled or In progress) - latest 10
    const assetsUnderRepair = await prisma.assetsMaintenance.findMany({
      where: {
        status: {
          in: ['Scheduled', 'In progress'],
        },
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
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    })

    return NextResponse.json({
      assetValueByCategory,
      activeCheckouts,
      recentCheckins,
      assetsUnderRepair,
      summary: {
        totalActiveAssets,
        totalValue,
        purchasesInFiscalYear,
        checkedOutCount,
        availableCount,
        checkedOutAndAvailable,
      },
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}

