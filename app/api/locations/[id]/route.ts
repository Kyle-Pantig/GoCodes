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
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const { id } = await params

    const location = await retryDbOperation(() =>
      prisma.assetsLocation.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
        },
      })
    )

    return NextResponse.json({ location })
  } catch (error: any) {
    console.error('Error updating location:', error)
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A location with this name already exists' },
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
      { error: 'Failed to update location' },
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
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params

      // Check if location exists and has associated assets
      const location = await retryDbOperation(() =>
        prisma.assetsLocation.findUnique({
          where: { id },
        })
      )

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      )
    }

    // Check if any assets use this location
    const assetsWithLocation = await retryDbOperation(() =>
      prisma.assets.findMany({
        where: {
          location: location.name,
          isDeleted: false,
        },
        take: 1,
      })
    )

    if (assetsWithLocation.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete location with associated assets. Please reassign or delete assets first.' },
        { status: 400 }
      )
    }

    // Delete location
    await retryDbOperation(() =>
      prisma.assetsLocation.delete({
        where: { id },
      })
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting location:', error)
    
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete location' },
      { status: 500 }
    )
  }
}

