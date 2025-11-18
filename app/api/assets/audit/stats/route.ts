import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canAudit')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    // Get recent audit history (last 10 audits) with retry logic
    const recentAudits = await retryDbOperation(() =>
      prisma.assetsAuditHistory.findMany({
        take: 10,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    )

    return NextResponse.json({
      recentAudits,
    })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    // Only log non-transient errors
    if (prismaError?.code !== 'P1001') {
      console.error('Error fetching audit statistics:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch audit statistics' },
      { status: 500 }
    )
  }
}

