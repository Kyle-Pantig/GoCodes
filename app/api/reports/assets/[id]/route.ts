import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check view permission
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params

    // Check if report exists and belongs to the user
    const report = await retryDbOperation(() => prisma.assetReports.findUnique({
      where: { id },
      select: { userId: true },
    }))

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // Verify ownership (users can only delete their own reports)
    if (report.userId !== auth.user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this report' },
        { status: 403 }
      )
    }

    // Delete the report
    await retryDbOperation(() => prisma.assetReports.delete({
      where: { id },
    }))

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code !== 'P1001' && prismaError?.code !== 'P2024') {
      console.error('Error deleting asset report:', error)
    }
    return NextResponse.json(
      { error: 'Failed to delete asset report' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check view permission
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params

    const report = await retryDbOperation(() => prisma.assetReports.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        subCategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }))

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (report.userId !== auth.user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to view this report' },
        { status: 403 }
      )
    }

    return NextResponse.json({ report })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code !== 'P1001' && prismaError?.code !== 'P2024') {
      console.error('Error fetching asset report:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch asset report' },
      { status: 500 }
    )
  }
}

