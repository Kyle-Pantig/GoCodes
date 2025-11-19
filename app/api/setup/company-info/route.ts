import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Allow read access to all authenticated users (for logo display in sidebar)
  // Only require permission for write operations (POST)
  try {
    // Get company info - there should only be one record
    const companyInfo = await retryDbOperation(() =>
      prisma.companyInfo.findFirst({
        orderBy: { createdAt: 'desc' },
      })
    )

    return NextResponse.json({ companyInfo })
  } catch (error) {
    console.error('Error fetching company info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch company info' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageSetup')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const {
      companyName,
      contactEmail,
      contactPhone,
      address,
      zipCode,
      country,
      website,
      primaryLogoUrl,
      secondaryLogoUrl,
    } = body

    if (!companyName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    // Check if company info already exists
    const existing = await retryDbOperation(() =>
      prisma.companyInfo.findFirst()
    )

    let companyInfo
    if (existing) {
      // Update existing record
      companyInfo = await retryDbOperation(() =>
        prisma.companyInfo.update({
          where: { id: existing.id },
          data: {
            companyName,
            contactEmail,
            contactPhone,
            address,
            zipCode,
            country,
            website,
            primaryLogoUrl,
            secondaryLogoUrl,
          },
        })
      )
    } else {
      // Create new record
      companyInfo = await retryDbOperation(() =>
        prisma.companyInfo.create({
          data: {
            companyName,
            contactEmail,
            contactPhone,
            address,
            zipCode,
            country,
            website,
            primaryLogoUrl,
            secondaryLogoUrl,
          },
        })
      )
    }

    return NextResponse.json({ companyInfo }, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error('Error saving company info:', error)
    return NextResponse.json(
      { error: 'Failed to save company info' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  // PUT is same as POST - upsert behavior
  return POST(request)
}

