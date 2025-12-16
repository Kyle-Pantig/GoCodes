import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageMaintenance')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const assetId = searchParams.get('assetId')
    const search = searchParams.get('search')
    
    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }
    if (assetId) {
      where.assetId = assetId
    }
    
    // Add search functionality
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
        { maintenanceBy: { contains: search, mode: 'insensitive' } },
        {
          asset: {
            OR: [
              { assetTagId: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ]
    }

    // Get total count
    const total = await retryDbOperation(() =>
      prisma.assetsMaintenance.count({ where })
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaClient = prisma as any
    const maintenances = await retryDbOperation(() => prismaClient.assetsMaintenance.findMany({
      where,
      include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
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
          },
          inventoryItems: {
            include: {
              inventoryItem: {
                select: {
                  id: true,
                  itemCode: true,
                  name: true,
                  unit: true,
                  unitCost: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    }))

    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      maintenances,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    })
  } catch (error) {
    console.error('Error fetching maintenances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch maintenances' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageMaintenance')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const {
      assetId,
      title,
      details,
      dueDate,
      maintenanceBy,
      status,
      dateCompleted,
      dateCancelled,
      cost,
      isRepeating,
      inventoryItems,
    } = body

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      )
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Maintenance title is required' },
        { status: 400 }
      )
    }

    if (!status) {
      return NextResponse.json(
        { error: 'Maintenance status is required' },
        { status: 400 }
      )
    }

    // Validate status-specific fields
    if (status === 'Completed' && !dateCompleted) {
      return NextResponse.json(
        { error: 'Date completed is required when status is Completed' },
        { status: 400 }
      )
    }

    if (status === 'Cancelled' && !dateCancelled) {
      return NextResponse.json(
        { error: 'Date cancelled is required when status is Cancelled' },
        { status: 400 }
      )
    }

    // Check if asset exists
    const asset = await prisma.assets.findUnique({
      where: { id: assetId },
    })

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // Validate inventory items if provided
    if (inventoryItems && Array.isArray(inventoryItems) && inventoryItems.length > 0) {
      // Check if status is Completed and validate stock availability
      if (status === 'Completed') {
        for (const item of inventoryItems) {
          const inventoryItem = await prisma.inventoryItem.findUnique({
            where: { id: item.inventoryItemId },
            select: { id: true, name: true, currentStock: true, itemCode: true },
          })

          if (!inventoryItem) {
            return NextResponse.json(
              { error: `Inventory item not found: ${item.inventoryItemId}` },
              { status: 404 }
            )
          }

          const quantity = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity
          const currentStock = Number(inventoryItem.currentStock)
          if (currentStock < quantity) {
            return NextResponse.json(
              { 
                error: `Insufficient stock for ${inventoryItem.name} (${inventoryItem.itemCode}). Available: ${currentStock}, Required: ${quantity}` 
              },
              { status: 400 }
            )
          }
        }
      }
    }

    // Get user info for inventory transactions
    const userName =
      auth.user.user_metadata?.name ||
      auth.user.user_metadata?.full_name ||
      auth.user.email?.split('@')[0] ||
      auth.user.email ||
      auth.user.id

    // Create maintenance record and update asset status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create maintenance record
      const maintenance = await tx.assetsMaintenance.create({
        data: {
          assetId,
          title,
          details: details || null,
          dueDate: dueDate ? parseDate(dueDate) : null,
          maintenanceBy: maintenanceBy || null,
          status,
          dateCompleted: dateCompleted ? parseDate(dateCompleted) : null,
          dateCancelled: dateCancelled ? parseDate(dateCancelled) : null,
          cost: cost ? parseFloat(cost.toString()) : null,
          isRepeating: isRepeating || false,
        },
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
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
          },
        },
      })

      // Create inventory items records if provided
      if (inventoryItems && Array.isArray(inventoryItems) && inventoryItems.length > 0) {
        for (const item of inventoryItems) {
          const quantity = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity
          const unitCost = item.unitCost 
            ? (typeof item.unitCost === 'string' ? parseFloat(item.unitCost) : item.unitCost)
            : null

          // Get inventory item to use its unit cost if not provided
          const inventoryItem = await tx.inventoryItem.findUnique({
            where: { id: item.inventoryItemId },
            select: { unitCost: true },
          })

          const finalUnitCost = unitCost ?? (inventoryItem?.unitCost ? parseFloat(inventoryItem.unitCost.toString()) : null)

          await tx.maintenanceInventoryItem.create({
            data: {
              maintenanceId: maintenance.id,
              inventoryItemId: item.inventoryItemId,
              quantity,
              unitCost: finalUnitCost,
            },
          })

          // If status is Completed, create inventory transaction and reduce stock
          if (status === 'Completed') {
            // Create OUT transaction
            await tx.inventoryTransaction.create({
              data: {
                inventoryItemId: item.inventoryItemId,
                transactionType: 'OUT',
                quantity,
                unitCost: finalUnitCost,
                reference: `Maintenance: ${title}`,
                notes: `Maintenance record: ${maintenance.id}`,
                actionBy: userName,
                transactionDate: dateCompleted ? (parseDate(dateCompleted) || new Date()) : new Date(),
              },
            })

            // Update inventory item stock
            await tx.inventoryItem.update({
              where: { id: item.inventoryItemId },
              data: {
                currentStock: {
                  decrement: quantity,
                },
              },
            })
          }
        }
      }

      // Update asset status based on maintenance status
      let newAssetStatus: string | null = null
      if (status === 'Completed' || status === 'Cancelled') {
        newAssetStatus = 'Available'
      } else if (status === 'Scheduled' || status === 'In progress') {
        newAssetStatus = 'Maintenance'
      }

      if (newAssetStatus !== null) {
        await tx.assets.update({
          where: { id: assetId },
          data: { status: newAssetStatus },
        })
      }

      // Fetch maintenance with inventory items
      const maintenanceWithItems = await tx.assetsMaintenance.findUnique({
        where: { id: maintenance.id },
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
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
          },
          inventoryItems: {
            include: {
              inventoryItem: {
                select: {
                  id: true,
                  itemCode: true,
                  name: true,
                  unit: true,
                },
              },
            },
          },
        },
      })

      return maintenanceWithItems || maintenance
    })

    return NextResponse.json({
      success: true,
      maintenance: result,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create maintenance'
    console.error('Error creating maintenance:', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageMaintenance')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const {
      id,
      title,
      details,
      dueDate,
      maintenanceBy,
      status,
      dateCompleted,
      dateCancelled,
      cost,
      isRepeating,
      inventoryItems,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Maintenance ID is required' },
        { status: 400 }
      )
    }

    // Get current maintenance to find assetId and current status
    const currentMaintenance = await prisma.assetsMaintenance.findUnique({
      where: { id },
      select: { 
        assetId: true,
        status: true,
        inventoryItems: {
          include: {
            inventoryItem: {
              select: {
                id: true,
                itemCode: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!currentMaintenance) {
      return NextResponse.json(
        { error: 'Maintenance not found' },
        { status: 404 }
      )
    }

    const previousStatus = currentMaintenance.status
    const isStatusChangingToCompleted = status !== undefined && status === 'Completed' && previousStatus !== 'Completed'
    const isStatusChangingFromCompleted = status !== undefined && previousStatus === 'Completed' && status !== 'Completed'

    // Validate status-specific fields
    if (status === 'Completed' && !dateCompleted) {
      return NextResponse.json(
        { error: 'Date completed is required when status is Completed' },
        { status: 400 }
      )
    }

    if (status === 'Cancelled' && !dateCancelled) {
      return NextResponse.json(
        { error: 'Date cancelled is required when status is Cancelled' },
        { status: 400 }
      )
    }

    // Validate inventory items if status is changing to Completed
    if (isStatusChangingToCompleted && inventoryItems && Array.isArray(inventoryItems) && inventoryItems.length > 0) {
      for (const item of inventoryItems) {
        const inventoryItem = await prisma.inventoryItem.findUnique({
          where: { id: item.inventoryItemId },
          select: { id: true, name: true, currentStock: true, itemCode: true },
        })

        if (!inventoryItem) {
          return NextResponse.json(
            { error: `Inventory item not found: ${item.inventoryItemId}` },
            { status: 404 }
          )
        }

        const quantity = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity
        const currentStock = Number(inventoryItem.currentStock)
        if (currentStock < quantity) {
          return NextResponse.json(
            { 
              error: `Insufficient stock for ${inventoryItem.name} (${inventoryItem.itemCode}). Available: ${currentStock}, Required: ${quantity}` 
            },
            { status: 400 }
          )
        }
      }
    }

    // Get user info for inventory transactions
    const userName =
      auth.user.user_metadata?.name ||
      auth.user.user_metadata?.full_name ||
      auth.user.email?.split('@')[0] ||
      auth.user.email ||
      auth.user.id

    // Update maintenance record and asset status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update maintenance record
      const updateData: Record<string, unknown> = {}
      if (title !== undefined) updateData.title = title
      if (details !== undefined) updateData.details = details || null
      if (dueDate !== undefined) updateData.dueDate = dueDate ? parseDate(dueDate) : null
      if (maintenanceBy !== undefined) updateData.maintenanceBy = maintenanceBy || null
      if (status !== undefined) updateData.status = status
      if (dateCompleted !== undefined) updateData.dateCompleted = dateCompleted ? parseDate(dateCompleted) : null
      if (dateCancelled !== undefined) updateData.dateCancelled = dateCancelled ? parseDate(dateCancelled) : null
      if (cost !== undefined) updateData.cost = cost ? parseFloat(cost.toString()) : null
      if (isRepeating !== undefined) updateData.isRepeating = isRepeating

      const maintenance = await tx.assetsMaintenance.update({
        where: { id },
        data: updateData,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
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
          },
        },
      })

      // Handle inventory items updates if provided
      if (inventoryItems !== undefined) {
        // Delete existing inventory items
        await tx.maintenanceInventoryItem.deleteMany({
          where: { maintenanceId: id },
        })

        // If status was previously Completed, reverse inventory transactions
        if (isStatusChangingFromCompleted) {
          // Find and reverse previous transactions (optional - can be implemented later)
          // For now, we'll just delete the maintenance inventory items
        }

        // Create new inventory items if provided
        if (Array.isArray(inventoryItems) && inventoryItems.length > 0) {
          for (const item of inventoryItems) {
            const quantity = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity
            const unitCost = item.unitCost 
              ? (typeof item.unitCost === 'string' ? parseFloat(item.unitCost) : item.unitCost)
              : null

            // Get inventory item to use its unit cost if not provided
            const inventoryItem = await tx.inventoryItem.findUnique({
              where: { id: item.inventoryItemId },
              select: { unitCost: true },
            })

            const finalUnitCost = unitCost ?? (inventoryItem?.unitCost ? parseFloat(inventoryItem.unitCost.toString()) : null)

            await tx.maintenanceInventoryItem.create({
              data: {
                maintenanceId: id,
                inventoryItemId: item.inventoryItemId,
                quantity,
                unitCost: finalUnitCost,
              },
            })

            // If status is changing to Completed, create inventory transaction and reduce stock
            if (isStatusChangingToCompleted) {
              // Create OUT transaction
              await tx.inventoryTransaction.create({
                data: {
                  inventoryItemId: item.inventoryItemId,
                  transactionType: 'OUT',
                  quantity,
                  unitCost: finalUnitCost,
                  reference: `Maintenance: ${maintenance.title}`,
                  notes: `Maintenance record: ${id}`,
                  actionBy: userName,
                  transactionDate: dateCompleted ? (parseDate(dateCompleted) || new Date()) : new Date(),
                },
              })

              // Update inventory item stock
              await tx.inventoryItem.update({
                where: { id: item.inventoryItemId },
                data: {
                  currentStock: {
                    decrement: quantity,
                  },
                },
              })
            }
          }
        }
      } else if (isStatusChangingToCompleted) {
        // If inventory items are not being updated but status is changing to Completed,
        // process existing inventory items
        const existingItems = await tx.maintenanceInventoryItem.findMany({
          where: { maintenanceId: id },
          include: {
            inventoryItem: {
              select: {
                id: true,
                currentStock: true,
                unitCost: true,
              },
            },
          },
        })

        for (const maintenanceItem of existingItems) {
          const quantity = parseFloat(maintenanceItem.quantity.toString())
          const unitCost = maintenanceItem.unitCost 
            ? parseFloat(maintenanceItem.unitCost.toString())
            : (maintenanceItem.inventoryItem.unitCost ? parseFloat(maintenanceItem.inventoryItem.unitCost.toString()) : null)

          // Check stock availability
          const currentStock = Number(maintenanceItem.inventoryItem.currentStock)
          if (currentStock < quantity) {
            throw new Error(`Insufficient stock for inventory item. Available: ${currentStock}, Required: ${quantity}`)
          }

          // Create OUT transaction
          await tx.inventoryTransaction.create({
            data: {
              inventoryItemId: maintenanceItem.inventoryItemId,
              transactionType: 'OUT',
              quantity,
              unitCost,
              reference: `Maintenance: ${maintenance.title}`,
              notes: `Maintenance record: ${id}`,
              actionBy: userName,
              transactionDate: dateCompleted ? (parseDate(dateCompleted) || new Date()) : new Date(),
            },
          })

          // Update inventory item stock
          await tx.inventoryItem.update({
            where: { id: maintenanceItem.inventoryItemId },
            data: {
              currentStock: {
                decrement: quantity,
              },
            },
          })
        }
      }

      // Update asset status based on maintenance status
      if (status !== undefined) {
        let newAssetStatus: string | null = null
        if (status === 'Completed' || status === 'Cancelled') {
          newAssetStatus = 'Available'
        } else if (status === 'Scheduled' || status === 'In progress') {
          newAssetStatus = 'Maintenance'
        }

        if (newAssetStatus !== null) {
          await tx.assets.update({
            where: { id: currentMaintenance.assetId },
            data: { status: newAssetStatus },
          })
        }
      }

      // Fetch maintenance with inventory items
      const maintenanceWithItems = await tx.assetsMaintenance.findUnique({
        where: { id },
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
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
          },
          inventoryItems: {
            include: {
              inventoryItem: {
                select: {
                  id: true,
                  itemCode: true,
                  name: true,
                  unit: true,
                },
              },
            },
          },
        },
      })

      return maintenanceWithItems || maintenance
    })

    return NextResponse.json({
      success: true,
      maintenance: result,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update maintenance'
    console.error('Error updating maintenance:', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

