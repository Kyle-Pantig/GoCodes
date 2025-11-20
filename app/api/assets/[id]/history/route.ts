import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const assetId = resolvedParams.id

    const logs = await prisma.assetsHistoryLogs.findMany({
      where: {
        assetId: assetId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Error fetching history logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch history logs' },
      { status: 500 }
    )
  }
}

