import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-utils'
import * as XLSX from 'xlsx'

type ReservationTypeStats = {
  count: number
  totalValue: number
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const includeReservationList = searchParams.get('includeReservationList') === 'true'
    
    // Build query params for the reservation report API
    const params = new URLSearchParams()
    const category = searchParams.get('category')
    const reservationType = searchParams.get('reservationType')
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const department = searchParams.get('department')
    const employeeId = searchParams.get('employeeId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    if (category) params.set('category', category)
    if (reservationType) params.set('reservationType', reservationType)
    if (location) params.set('location', location)
    if (site) params.set('site', site)
    if (department) params.set('department', department)
    if (employeeId) params.set('employeeId', employeeId)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    
    // If including reservation list, fetch all reservations (not just current page)
    if (includeReservationList) {
      params.set('pageSize', '10000')
    }

    // Fetch reservation report data
    const baseUrl = request.nextUrl.origin
    const response = await fetch(`${baseUrl}/api/reports/reservation?${params.toString()}`, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch reservation data')
    }

    const data = await response.json()
    const reservations = data.reservations || []

    // Calculate summary statistics
    const upcomingReservations = reservations.filter((r: { reservationStatus: string }) => r.reservationStatus === 'upcoming')
    const todayReservations = reservations.filter((r: { reservationStatus: string }) => r.reservationStatus === 'today')
    const pastReservations = reservations.filter((r: { reservationStatus: string }) => r.reservationStatus === 'past')
    const employeeReservations = reservations.filter((r: { reservationType: string }) => r.reservationType === 'Employee')
    const departmentReservations = reservations.filter((r: { reservationType: string }) => r.reservationType === 'Department')
    const totalAssetValue = reservations.reduce((sum: number, r: { assetCost: number | null }) => sum + (r.assetCost || 0), 0)

    const byType = reservations.reduce((acc: Record<string, ReservationTypeStats>, reservation: { reservationType: string; assetCost: number | null }) => {
      const type = reservation.reservationType
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          totalValue: 0,
        }
      }
      acc[type].count++
      acc[type].totalValue += reservation.assetCost || 0
      return acc
    }, {})

    // Helper function to format numbers with commas
    const formatNumber = (value: number | null | undefined): string => {
      if (value === null || value === undefined || isNaN(value)) {
        return '0.00'
      }
      return Number(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }

    if (format === 'csv') {
      let csvContent = ''
      
      if (includeReservationList) {
        // Include summary and reservation list
        csvContent += 'RESERVATION REPORT SUMMARY\n'
        csvContent += `Total Reservations,${reservations.length}\n`
        csvContent += `Upcoming,${upcomingReservations.length}\n`
        csvContent += `Today,${todayReservations.length}\n`
        csvContent += `Past,${pastReservations.length}\n`
        csvContent += `Employee Reservations,${employeeReservations.length}\n`
        csvContent += `Department Reservations,${departmentReservations.length}\n`
        csvContent += `Total Asset Value,${formatNumber(totalAssetValue)}\n\n`
        
        csvContent += 'RESERVATIONS BY TYPE\n'
        csvContent += 'Reservation Type,Count,Total Asset Value\n'
        ;(Object.entries(byType) as [string, ReservationTypeStats][]).forEach(([type, stats]) => {
          csvContent += `${type},${stats.count},${formatNumber(stats.totalValue)}\n`
        })
        csvContent += '\n'
        
        csvContent += 'RESERVATION RECORDS\n'
        const headers = [
          'Asset Tag ID',
          'Description',
          'Category',
          'Sub-Category',
          'Reservation Type',
          'Reserved By',
          'Reservation Date',
          'Purpose',
          'Status',
          'Days Until/From',
          'Location',
          'Site',
          'Asset Cost',
        ]
        csvContent += headers.join(',') + '\n'
        reservations.forEach((reservation: {
          assetTagId: string
          description: string
          category: string | null
          subCategory: string | null
          reservationType: string
          department: string | null
          employeeName: string | null
          reservationDate: string
          purpose: string | null
          reservationStatus: string
          daysUntil: number
          location: string | null
          site: string | null
          assetCost: number | null
        }) => {
          const reservedBy = reservation.reservationType === 'Employee' 
            ? reservation.employeeName || 'N/A'
            : reservation.department || 'N/A'
          const daysText = reservation.daysUntil > 0 
            ? `${reservation.daysUntil} days until`
            : reservation.daysUntil === 0
            ? 'Today'
            : `${Math.abs(reservation.daysUntil)} days ago`
          csvContent += [
            reservation.assetTagId,
            `"${reservation.description}"`,
            reservation.category || 'N/A',
            reservation.subCategory || 'N/A',
            reservation.reservationType,
            reservedBy,
            reservation.reservationDate.split('T')[0],
            reservation.purpose || 'N/A',
            reservation.reservationStatus,
            daysText,
            reservation.location || 'N/A',
            reservation.site || 'N/A',
            formatNumber(reservation.assetCost),
          ].join(',') + '\n'
        })
      } else {
        // Summary only
        csvContent += 'RESERVATION REPORT SUMMARY\n'
        csvContent += `Total Reservations,${reservations.length}\n`
        csvContent += `Upcoming,${upcomingReservations.length}\n`
        csvContent += `Today,${todayReservations.length}\n`
        csvContent += `Past,${pastReservations.length}\n`
        csvContent += `Employee Reservations,${employeeReservations.length}\n`
        csvContent += `Department Reservations,${departmentReservations.length}\n`
        csvContent += `Total Asset Value,${formatNumber(totalAssetValue)}\n\n`
        csvContent += 'RESERVATIONS BY TYPE\n'
        csvContent += 'Reservation Type,Count,Total Asset Value\n'
        ;(Object.entries(byType) as [string, ReservationTypeStats][]).forEach(([type, stats]) => {
          csvContent += `${type},${stats.count},${formatNumber(stats.totalValue)}\n`
        })
      }

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="reservation-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    if (format === 'excel') {
      const workbook = XLSX.utils.book_new()

      // Summary sheet
      const summaryData = [
        ['RESERVATION REPORT SUMMARY'],
        ['Total Reservations', reservations.length],
        ['Upcoming', upcomingReservations.length],
        ['Today', todayReservations.length],
        ['Past', pastReservations.length],
        ['Employee Reservations', employeeReservations.length],
        ['Department Reservations', departmentReservations.length],
        ['Total Asset Value', formatNumber(totalAssetValue)],
        [],
        ['RESERVATIONS BY TYPE'],
        ['Reservation Type', 'Count', 'Total Asset Value'],
        ...(Object.entries(byType) as [string, ReservationTypeStats][]).map(([type, stats]) => [
          type,
          stats.count,
          formatNumber(stats.totalValue),
        ]),
      ]
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

      if (includeReservationList) {
        // Reservation list sheet
        const reservationData = reservations.map((reservation: {
          assetTagId: string
          description: string
          category: string | null
          subCategory: string | null
          reservationType: string
          department: string | null
          employeeName: string | null
          reservationDate: string
          purpose: string | null
          reservationStatus: string
          daysUntil: number
          location: string | null
          site: string | null
          assetCost: number | null
        }) => {
          const reservedBy = reservation.reservationType === 'Employee' 
            ? reservation.employeeName || 'N/A'
            : reservation.department || 'N/A'
          const daysText = reservation.daysUntil > 0 
            ? `${reservation.daysUntil} days until`
            : reservation.daysUntil === 0
            ? 'Today'
            : `${Math.abs(reservation.daysUntil)} days ago`
          return {
            'Asset Tag ID': reservation.assetTagId,
            'Description': reservation.description,
            'Category': reservation.category || 'N/A',
            'Sub-Category': reservation.subCategory || 'N/A',
            'Reservation Type': reservation.reservationType,
            'Reserved By': reservedBy,
            'Reservation Date': reservation.reservationDate.split('T')[0],
            'Purpose': reservation.purpose || 'N/A',
            'Status': reservation.reservationStatus,
            'Days Until/From': daysText,
            'Location': reservation.location || 'N/A',
            'Site': reservation.site || 'N/A',
            'Asset Cost': formatNumber(reservation.assetCost),
          }
        })
        const reservationSheet = XLSX.utils.json_to_sheet(reservationData)
        XLSX.utils.book_append_sheet(workbook, reservationSheet, 'Reservation List')
      }

      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="reservation-report-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      })
    }

    // PDF format - return error for now (can be implemented later)
    return NextResponse.json(
      { error: 'PDF export not yet implemented for reservation reports' },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error exporting reservation reports:', error)
    return NextResponse.json(
      { error: 'Failed to export reservation reports' },
      { status: 500 }
    )
  }
}

