import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function GET(request: NextRequest) {
  try {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed) return permissionCheck.error

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')

    // Use select instead of include to reduce data transfer and connection time
    const subcategories = await prisma.subCategory.findMany({
      where: categoryId ? { categoryId } : undefined,
      select: {
        id: true,
        name: true,
        description: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ subcategories })
  } catch (error) {
    // Handle connection pool errors specifically
    if (error instanceof Error && error.message.includes('connection pool')) {
      console.error('[Subcategories API] Connection pool exhausted:', error.message)
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    
    console.error('Error fetching subcategories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subcategories' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageCategories')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    
    const subcategory = await prisma.subCategory.create({
      data: {
        name: body.name,
        description: body.description,
        categoryId: body.categoryId,
      },
      include: {
        category: true,
      },
    })

    return NextResponse.json({ subcategory }, { status: 201 })
  } catch (error) {
    console.error('Error creating subcategory:', error)
    return NextResponse.json(
      { error: 'Failed to create subcategory' },
      { status: 500 }
    )
  }
}

