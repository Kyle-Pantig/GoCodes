import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

// Clear the document files cache after delete
declare global {
  var documentFilesCache: {
    files: Array<{
      name: string
      id: string
      created_at: string
      path: string
      bucket: string
    }>
    timestamp: number
  } | undefined
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const auth = await verifyAuth()
    if (auth.error || !auth.user) {
      return auth.error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check edit permission
    const permissionCheck = await requirePermission('canEditAssets')
    if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Check if document exists first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingDocument = await (prisma as any).assetsDocument.findUnique({
      where: {
        id: id,
      },
    })

    if (!existingDocument) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Delete document from database only (keep file in bucket)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).assetsDocument.delete({
      where: {
        id: id,
      },
    })

    // Clear the document files cache so the deletion appears immediately
    if (typeof globalThis !== 'undefined') {
      globalThis.documentFilesCache = undefined
    }

    return NextResponse.json({ success: true, message: 'Document deleted from database' })
  } catch (error: unknown) {
    console.error('Error deleting document:', error)
    
    // Handle Prisma record not found error
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}

