import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const auth = await verifyAuth()
    if (auth.error || !auth.user) {
      return auth.error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check view permission
    const permissionCheck = await requirePermission('canViewAssets')
    if (!permissionCheck.allowed) return permissionCheck.error

    const searchParams = request.nextUrl.searchParams
    const assetTagIdsParam = searchParams.get('assetTagIds')

    if (!assetTagIdsParam) {
      return NextResponse.json(
        { error: 'assetTagIds parameter is required' },
        { status: 400 }
      )
    }

    // Parse comma-separated asset tag IDs
    const assetTagIds = assetTagIdsParam.split(',').map(id => id.trim()).filter(Boolean)

    if (assetTagIds.length === 0) {
      return NextResponse.json([])
    }

    // Fetch images for all assets
    // Using 'as any' temporarily until Prisma client is regenerated after schema changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const images = await (prisma as any).assetsImage.findMany({
      where: {
        assetTagId: { in: assetTagIds },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        assetTagId: true,
        imageUrl: true,
      },
    })

    // Group images by assetTagId
    const imagesByAssetTag = new Map<string, string[]>()
    images.forEach((img: { assetTagId: string; imageUrl: string }) => {
      if (!imagesByAssetTag.has(img.assetTagId)) {
        imagesByAssetTag.set(img.assetTagId, [])
      }
      imagesByAssetTag.get(img.assetTagId)!.push(img.imageUrl)
    })

    // Return array of { assetTagId, images: [{ imageUrl }] }
    const result = assetTagIds.map(assetTagId => ({
      assetTagId,
      images: (imagesByAssetTag.get(assetTagId) || []).map(imageUrl => ({ imageUrl })),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching bulk asset images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch asset images' },
      { status: 500 }
    )
  }
}

