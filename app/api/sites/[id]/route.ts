import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageSetup')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    const { id } = await params

    const site = await retryDbOperation(() =>
      prisma.assetsSite.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
        },
      })
    )

    return NextResponse.json({ site })
  } catch (error: any) {
    console.error('Error updating site:', error)
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A site with this name already exists' },
        { status: 409 }
      )
    }

    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update site' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageSetup')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params

    // Check if site exists and has associated assets
    const site = await retryDbOperation(() =>
      prisma.assetsSite.findUnique({
        where: { id },
      })
    )

    if (!site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      )
    }

    // Check if any assets use this site
    const assetsWithSite = await retryDbOperation(() =>
      prisma.assets.findMany({
        where: {
          site: site.name,
          isDeleted: false,
        },
        take: 1,
      })
    )

    if (assetsWithSite.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete site with ${assetsWithSite.length} associated asset(s). Please reassign or delete assets first.` },
        { status: 400 }
      )
    }

    // Delete site
    await retryDbOperation(() =>
      prisma.assetsSite.delete({
        where: { id },
      })
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting site:', error)
    
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete site' },
      { status: 500 }
    )
  }
}

