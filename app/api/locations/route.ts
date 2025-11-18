import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // All authenticated users can view locations
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    
    const where = search
      ? {
          name: {
            contains: search,
            mode: 'insensitive' as const,
          },
        }
      : {}

    const locations = await retryDbOperation(() =>
      prisma.assetsLocation.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
      })
    )

    return NextResponse.json({ locations })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    console.error('Error fetching locations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageSetup')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    const { name, description } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Location name is required' },
        { status: 400 }
      )
    }

    const location = await retryDbOperation(() =>
      prisma.assetsLocation.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
        },
      })
    )

    return NextResponse.json({ location }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating location:', error)
    
    // Handle unique constraint violation (duplicate name)
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
      { error: 'Failed to create location' },
      { status: 500 }
    )
  }
}

