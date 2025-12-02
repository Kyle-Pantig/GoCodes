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
    const depreciationMethod = searchParams.get('depreciationMethod')
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const isDepreciable = searchParams.get('isDepreciable')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const skip = (page - 1) * pageSize

    // Build where clause
    const where: Prisma.AssetsWhereInput = {
      isDeleted: false,
    }

    // Category filter
    if (category) {
      where.category = {
        name: category,
      }
    }

    // Depreciation method filter
    if (depreciationMethod) {
      where.depreciationMethod = depreciationMethod
    }

    // Location filter
    if (location) {
      where.location = location
    }

    // Site filter
    if (site) {
      where.site = site
    }

    // Depreciable asset filter
    if (isDepreciable === 'true') {
      where.depreciableAsset = true
    } else if (isDepreciable === 'false') {
      where.depreciableAsset = false
    }

    // Date range filter (dateAcquired)
    if (startDate || endDate) {
      where.dateAcquired = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    // Get total count for pagination
    const total = await retryDbOperation(() =>
      prisma.assets.count({
        where,
      })
    )

    // Get paginated assets
    const assets = await retryDbOperation(() =>
      prisma.assets.findMany({
        where,
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
          depreciableAsset: true,
          depreciableCost: true,
          salvageValue: true,
          assetLifeMonths: true,
          depreciationMethod: true,
          dateAcquired: true,
          location: true,
          site: true,
        },
        orderBy: {
          dateAcquired: 'desc',
        },
        skip,
        take: pageSize,
      })
    )

    // Calculate depreciation for each asset
    const formattedAssets = assets.map((asset) => {
      let monthlyDepreciation = 0
      let annualDepreciation = 0
      let accumulatedDepreciation = 0
      let currentValue = 0
      let depreciationYears = 0
      let depreciationMonths = 0

      if (asset.depreciableAsset && asset.depreciableCost && asset.assetLifeMonths && asset.dateAcquired) {
        const depreciableAmount = Number(asset.depreciableCost) - (Number(asset.salvageValue) || 0)
        const monthsElapsed = asset.assetLifeMonths > 0 
          ? Math.min(
              Math.floor(
                (new Date().getTime() - new Date(asset.dateAcquired).getTime()) / (1000 * 60 * 60 * 24 * 30)
              ),
              asset.assetLifeMonths
            )
          : 0

        if (asset.depreciationMethod === 'Straight-line' || !asset.depreciationMethod) {
          // Straight-line depreciation
          monthlyDepreciation = asset.assetLifeMonths > 0 ? depreciableAmount / asset.assetLifeMonths : 0
          annualDepreciation = monthlyDepreciation * 12
          accumulatedDepreciation = monthlyDepreciation * monthsElapsed
          currentValue = Number(asset.depreciableCost) - accumulatedDepreciation
          depreciationYears = Math.floor(monthsElapsed / 12)
          depreciationMonths = monthsElapsed % 12
        } else if (asset.depreciationMethod === 'Declining Balance') {
          // Declining balance depreciation (simplified - using 200% declining balance)
          const rate = asset.assetLifeMonths > 0 ? 2 / asset.assetLifeMonths : 0
          let remainingValue = Number(asset.depreciableCost)
          accumulatedDepreciation = 0
          
          for (let i = 0; i < monthsElapsed && i < asset.assetLifeMonths; i++) {
            const monthlyDep = remainingValue * rate
            accumulatedDepreciation += monthlyDep
            remainingValue -= monthlyDep
            if (remainingValue < (Number(asset.salvageValue) || 0)) {
              accumulatedDepreciation = Number(asset.depreciableCost) - (Number(asset.salvageValue) || 0)
              break
            }
          }
          
          monthlyDepreciation = monthsElapsed > 0 ? accumulatedDepreciation / monthsElapsed : 0
          annualDepreciation = monthlyDepreciation * 12
          currentValue = Number(asset.depreciableCost) - accumulatedDepreciation
          depreciationYears = Math.floor(monthsElapsed / 12)
          depreciationMonths = monthsElapsed % 12
        }
      }

      return {
        id: asset.id,
        assetTagId: asset.assetTagId,
        description: asset.description,
        category: asset.category?.name || null,
        subCategory: asset.subCategory?.name || null,
        originalCost: asset.cost ? Number(asset.cost) : null,
        depreciableCost: asset.depreciableCost ? Number(asset.depreciableCost) : null,
        salvageValue: asset.salvageValue ? Number(asset.salvageValue) : null,
        assetLifeMonths: asset.assetLifeMonths,
        depreciationMethod: asset.depreciationMethod || null,
        dateAcquired: asset.dateAcquired?.toISOString() || null,
        location: asset.location || null,
        site: asset.site || null,
        isDepreciable: asset.depreciableAsset || false,
        monthlyDepreciation,
        annualDepreciation,
        accumulatedDepreciation,
        currentValue,
        depreciationYears,
        depreciationMonths,
      }
    })

    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      assets: formattedAssets,
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
    console.error('Error fetching depreciation reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch depreciation reports' },
      { status: 500 }
    )
  }
}

