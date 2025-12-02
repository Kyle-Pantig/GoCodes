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
    const auditType = searchParams.get('auditType')
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const auditor = searchParams.get('auditor')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const skip = (page - 1) * pageSize

    // Build where clause
    const where: Prisma.AssetsAuditHistoryWhereInput = {
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

    // Audit type filter
    if (auditType) {
      where.auditType = auditType
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

    // Auditor filter
    if (auditor) {
      where.auditor = {
        contains: auditor,
        mode: 'insensitive',
      }
    }

    // Date range filter
    if (startDate || endDate) {
      where.auditDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    // Get total count for pagination
    const total = await retryDbOperation(() =>
      prisma.assetsAuditHistory.count({
        where,
      })
    )

    // Get paginated audit records
    const audits = await retryDbOperation(() =>
      prisma.assetsAuditHistory.findMany({
        where,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
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
            },
          },
        },
        orderBy: {
          auditDate: 'desc',
        },
        skip,
        take: pageSize,
      })
    )

    // Format the response
    const formattedAudits = audits.map((audit) => ({
      id: audit.id,
      assetTagId: audit.asset.assetTagId,
      category: audit.asset.category?.name || null,
      subCategory: audit.asset.subCategory?.name || null,
      auditName: audit.auditType,
      auditedToSite: audit.asset.site || null,
      auditedToLocation: audit.asset.location || null,
      lastAuditDate: audit.auditDate.toISOString(),
      auditBy: audit.auditor || null,
    }))

    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      audits: formattedAudits,
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
    console.error('Error fetching audit reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit reports' },
      { status: 500 }
    )
  }
}

