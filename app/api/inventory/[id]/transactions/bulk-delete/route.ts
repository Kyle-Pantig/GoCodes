import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageInventory')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { transactionIds } = body

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: 'Transaction IDs are required' },
        { status: 400 }
      )
    }

    // Check if it's a UUID (contains hyphens) or itemCode
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    
    // Get the inventory item to verify it exists
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: {
        ...(isUUID ? { id } : { itemCode: id }),
        isDeleted: false,
      },
      select: { id: true },
    })

    if (!inventoryItem) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    // Verify all transactions belong to this inventory item
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        id: { in: transactionIds },
        inventoryItemId: inventoryItem.id,
      },
      select: { id: true },
    })

    if (transactions.length !== transactionIds.length) {
      return NextResponse.json(
        { error: 'Some transactions not found or do not belong to this inventory item' },
        { status: 400 }
      )
    }

    // Delete transactions
    const result = await prisma.inventoryTransaction.deleteMany({
      where: {
        id: { in: transactionIds },
        inventoryItemId: inventoryItem.id,
      },
    })

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Successfully deleted ${result.count} transaction(s)`,
    })
  } catch (error) {
    console.error('Error bulk deleting transactions:', error)
    return NextResponse.json(
      { error: 'Failed to delete transactions' },
      { status: 500 }
    )
  }
}

