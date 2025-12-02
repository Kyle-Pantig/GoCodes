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
    const category = searchParams.get('category')
    const lessee = searchParams.get('lessee')
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const status = searchParams.get('status') // active, expired, upcoming
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const skip = (page - 1) * pageSize

    // Build where clause
    const where: Prisma.AssetsLeaseWhereInput = {
      asset: {
        isDeleted: false,
      },
    }

    // Category filter
    if (category) {
      where.asset = {
        ...where.asset,
        category: {
          name: category,
        },
      } as Prisma.AssetsWhereInput
    }

    // Lessee filter
    if (lessee) {
      where.lessee = {
        contains: lessee,
        mode: 'insensitive',
      }
    }

    // Location filter
    if (location) {
      where.asset = {
        ...where.asset,
        location: location,
      } as Prisma.AssetsWhereInput
    }

    // Site filter
    if (site) {
      where.asset = {
        ...where.asset,
        site: site,
      } as Prisma.AssetsWhereInput
    }

    // Status filter (active, expired, upcoming)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    
    if (status === 'active') {
      where.AND = [
        { leaseStartDate: { lte: now } },
        {
          OR: [
            { leaseEndDate: { gte: now } },
            { leaseEndDate: null },
          ],
        },
      ]
    } else if (status === 'expired') {
      where.leaseEndDate = {
        lt: now,
        not: null,
      }
    } else if (status === 'upcoming') {
      where.leaseStartDate = { gt: now }
    }

    // Date range filter (lease start date)
    if (startDate || endDate) {
      where.leaseStartDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    // Get total count for pagination
    const total = await retryDbOperation(() =>
      prisma.assetsLease.count({
        where,
      })
    )

    // Get paginated leases
    const leases = await retryDbOperation(() =>
      prisma.assetsLease.findMany({
        where,
        select: {
          id: true,
          lessee: true,
          leaseStartDate: true,
          leaseEndDate: true,
          conditions: true,
          notes: true,
          createdAt: true,
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
              cost: true,
              category: {
                select: {
                  name: true,
                },
              },
              subCategory: {
                select: {
                  name: true,
                },
              },
              location: true,
              site: true,
              status: true,
            },
          },
          returns: {
            select: {
              id: true,
              returnDate: true,
              condition: true,
            },
            orderBy: {
              returnDate: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          leaseStartDate: 'desc',
        },
        skip,
        take: pageSize,
      })
    )

    // Format lease data
    const formattedLeases = leases.map((lease) => {
      const leaseStart = new Date(lease.leaseStartDate)
      const leaseEnd = lease.leaseEndDate ? new Date(lease.leaseEndDate) : null
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      
      let leaseStatus = 'active'
      if (leaseEnd) {
        const endDate = new Date(leaseEnd)
        endDate.setHours(0, 0, 0, 0)
        if (endDate < now) {
          leaseStatus = 'expired'
        } else if (leaseStart > now) {
          leaseStatus = 'upcoming'
        }
      } else if (leaseStart > now) {
        leaseStatus = 'upcoming'
      }

      // Calculate days remaining or days expired
      let daysRemaining: number | null = null
      if (leaseEnd) {
        const diffTime = new Date(leaseEnd).getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        daysRemaining = diffDays
      }

      return {
        id: lease.id,
        assetTagId: lease.asset.assetTagId,
        description: lease.asset.description,
        category: lease.asset.category?.name || null,
        subCategory: lease.asset.subCategory?.name || null,
        lessee: lease.lessee,
        leaseStartDate: lease.leaseStartDate.toISOString(),
        leaseEndDate: lease.leaseEndDate?.toISOString() || null,
        conditions: lease.conditions || null,
        notes: lease.notes || null,
        location: lease.asset.location || null,
        site: lease.asset.site || null,
        assetStatus: lease.asset.status || null,
        assetCost: lease.asset.cost ? Number(lease.asset.cost) : null,
        leaseStatus,
        daysRemaining,
        lastReturnDate: lease.returns[0]?.returnDate.toISOString() || null,
        returnCondition: lease.returns[0]?.condition || null,
        createdAt: lease.createdAt.toISOString(),
      }
    })

    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      leases: formattedLeases,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    })
  } catch (error) {
    console.error('Error fetching lease reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lease reports' },
      { status: 500 }
    )
  }
}

