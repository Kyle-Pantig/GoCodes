import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { searchParams } = new URL(request.url)
    
    // Parse filters
    const category = searchParams.get('category')
    const reservationType = searchParams.get('reservationType') // Employee or Department
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const department = searchParams.get('department')
    const employeeId = searchParams.get('employeeId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const skip = (page - 1) * pageSize

    // Build where clause
    const where: Prisma.AssetsReserveWhereInput = {
      asset: {
        isDeleted: false,
      },
    }

    // Category filter
    if (category) {
      where.asset = {
        ...where.asset,
        category: {
          name: category,
        },
      } as Prisma.AssetsWhereInput
    }

    // Reservation type filter
    if (reservationType) {
      where.reservationType = reservationType as 'Employee' | 'Department'
    }

    // Location filter
    if (location) {
      where.asset = {
        ...where.asset,
        location: location,
      } as Prisma.AssetsWhereInput
    }

    // Site filter
    if (site) {
      where.asset = {
        ...where.asset,
        site: site,
      } as Prisma.AssetsWhereInput
    }

    // Department filter
    if (department) {
      where.department = department
    }

    // Employee filter
    if (employeeId) {
      where.employeeUserId = employeeId
    }

    // Date range filter (reservation date)
    if (startDate || endDate) {
      where.reservationDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    // Get total count for pagination
    const total = await retryDbOperation(() =>
      prisma.assetsReserve.count({
        where,
      })
    )

    // Get paginated reservations
    const reservations = await retryDbOperation(() =>
      prisma.assetsReserve.findMany({
        where,
        select: {
          id: true,
          reservationType: true,
          reservationDate: true,
          purpose: true,
          notes: true,
          createdAt: true,
          department: true,
          employeeUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
              cost: true,
              category: {
                select: {
                  name: true,
                },
              },
              subCategory: {
                select: {
                  name: true,
                },
              },
              location: true,
              site: true,
              status: true,
            },
          },
        },
        orderBy: {
          reservationDate: 'desc',
        },
        skip,
        take: pageSize,
      })
    )

    // Format reservation data
    const formattedReservations = reservations.map((reservation) => {
      const reservationDate = new Date(reservation.reservationDate)
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      reservationDate.setHours(0, 0, 0, 0)
      
      let reservationStatus = 'upcoming'
      if (reservationDate < now) {
        reservationStatus = 'past'
      } else if (reservationDate.getTime() === now.getTime()) {
        reservationStatus = 'today'
      }

      // Calculate days until/from reservation
      const diffTime = reservationDate.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      return {
        id: reservation.id,
        assetTagId: reservation.asset.assetTagId,
        description: reservation.asset.description,
        category: reservation.asset.category?.name || null,
        subCategory: reservation.asset.subCategory?.name || null,
        reservationType: reservation.reservationType,
        reservationDate: reservation.reservationDate.toISOString(),
        purpose: reservation.purpose || null,
        notes: reservation.notes || null,
        location: reservation.asset.location || null,
        site: reservation.asset.site || null,
        assetStatus: reservation.asset.status || null,
        assetCost: reservation.asset.cost ? Number(reservation.asset.cost) : null,
        department: reservation.department || null,
        employeeName: reservation.employeeUser?.name || null,
        employeeEmail: reservation.employeeUser?.email || null,
        reservationStatus,
        daysUntil: diffDays,
        createdAt: reservation.createdAt.toISOString(),
      }
    })

    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      reservations: formattedReservations,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    })
  } catch (error) {
    console.error('Error fetching reservation reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reservation reports' },
      { status: 500 }
    )
  }
}

