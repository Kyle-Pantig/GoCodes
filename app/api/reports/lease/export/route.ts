import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-utils'
import * as XLSX from 'xlsx'

type LesseeStats = {
  count: number
  totalValue: number
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const includeLeaseList = searchParams.get('includeLeaseList') === 'true'
    
    // Build query params for the lease report API
    const params = new URLSearchParams()
    const category = searchParams.get('category')
    const lessee = searchParams.get('lessee')
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    if (category) params.set('category', category)
    if (lessee) params.set('lessee', lessee)
    if (location) params.set('location', location)
    if (site) params.set('site', site)
    if (status) params.set('status', status)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    
    // If including lease list, fetch all leases (not just current page)
    if (includeLeaseList) {
      params.set('pageSize', '10000')
    }

    // Fetch lease report data
    const baseUrl = request.nextUrl.origin
    const response = await fetch(`${baseUrl}/api/reports/lease?${params.toString()}`, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch lease data')
    }

    const data = await response.json()
    const leases = data.leases || []

    // Calculate summary statistics
    const activeLeases = leases.filter((l: { leaseStatus: string }) => l.leaseStatus === 'active')
    const expiredLeases = leases.filter((l: { leaseStatus: string }) => l.leaseStatus === 'expired')
    const upcomingLeases = leases.filter((l: { leaseStatus: string }) => l.leaseStatus === 'upcoming')
    const totalAssetValue = leases.reduce((sum: number, l: { assetCost: number | null }) => sum + (l.assetCost || 0), 0)

    const byLessee = leases.reduce((acc: Record<string, LesseeStats>, lease: { lessee: string; assetCost: number | null }) => {
      const lessee = lease.lessee
      if (!acc[lessee]) {
        acc[lessee] = {
          count: 0,
          totalValue: 0,
        }
      }
      acc[lessee].count++
      acc[lessee].totalValue += lease.assetCost || 0
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
      
      if (includeLeaseList) {
        // Include summary and lease list
        csvContent += 'LEASED ASSET REPORT SUMMARY\n'
        csvContent += `Total Leases,${leases.length}\n`
        csvContent += `Active Leases,${activeLeases.length}\n`
        csvContent += `Expired Leases,${expiredLeases.length}\n`
        csvContent += `Upcoming Leases,${upcomingLeases.length}\n`
        csvContent += `Total Asset Value,${formatNumber(totalAssetValue)}\n\n`
        
        csvContent += 'LEASES BY LESSEE\n'
        csvContent += 'Lessee,Lease Count,Total Asset Value\n'
        ;(Object.entries(byLessee) as [string, LesseeStats][]).forEach(([lessee, stats]) => {
          csvContent += `${lessee},${stats.count},${formatNumber(stats.totalValue)}\n`
        })
        csvContent += '\n'
        
        csvContent += 'LEASE RECORDS\n'
        const headers = [
          'Asset Tag ID',
          'Description',
          'Category',
          'Sub-Category',
          'Lessee',
          'Lease Start Date',
          'Lease End Date',
          'Status',
          'Days Remaining',
          'Location',
          'Site',
          'Asset Cost',
        ]
        csvContent += headers.join(',') + '\n'
        leases.forEach((lease: {
          assetTagId: string
          description: string
          category: string | null
          subCategory: string | null
          lessee: string
          leaseStartDate: string
          leaseEndDate: string | null
          leaseStatus: string
          daysRemaining: number | null
          location: string | null
          site: string | null
          assetCost: number | null
        }) => {
          csvContent += [
            lease.assetTagId,
            `"${lease.description}"`,
            lease.category || 'N/A',
            lease.subCategory || 'N/A',
            lease.lessee,
            lease.leaseStartDate.split('T')[0],
            lease.leaseEndDate ? lease.leaseEndDate.split('T')[0] : 'N/A',
            lease.leaseStatus,
            lease.daysRemaining !== null ? lease.daysRemaining.toString() : 'N/A',
            lease.location || 'N/A',
            lease.site || 'N/A',
            formatNumber(lease.assetCost),
          ].join(',') + '\n'
        })
      } else {
        // Summary only
        csvContent += 'LEASED ASSET REPORT SUMMARY\n'
        csvContent += `Total Leases,${leases.length}\n`
        csvContent += `Active Leases,${activeLeases.length}\n`
        csvContent += `Expired Leases,${expiredLeases.length}\n`
        csvContent += `Upcoming Leases,${upcomingLeases.length}\n`
        csvContent += `Total Asset Value,${formatNumber(totalAssetValue)}\n\n`
        csvContent += 'LEASES BY LESSEE\n'
        csvContent += 'Lessee,Lease Count,Total Asset Value\n'
        ;(Object.entries(byLessee) as [string, LesseeStats][]).forEach(([lessee, stats]) => {
          csvContent += `${lessee},${stats.count},${formatNumber(stats.totalValue)}\n`
        })
      }

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="lease-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    if (format === 'excel') {
      const workbook = XLSX.utils.book_new()

      // Summary sheet
      const summaryData = [
        ['LEASED ASSET REPORT SUMMARY'],
        ['Total Leases', leases.length],
        ['Active Leases', activeLeases.length],
        ['Expired Leases', expiredLeases.length],
        ['Upcoming Leases', upcomingLeases.length],
        ['Total Asset Value', formatNumber(totalAssetValue)],
        [],
        ['LEASES BY LESSEE'],
        ['Lessee', 'Lease Count', 'Total Asset Value'],
        ...(Object.entries(byLessee) as [string, LesseeStats][]).map(([lessee, stats]) => [
          lessee,
          stats.count,
          formatNumber(stats.totalValue),
        ]),
      ]
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

      if (includeLeaseList) {
        // Lease list sheet
        const leaseData = leases.map((lease: {
          assetTagId: string
          description: string
          category: string | null
          subCategory: string | null
          lessee: string
          leaseStartDate: string
          leaseEndDate: string | null
          leaseStatus: string
          daysRemaining: number | null
          location: string | null
          site: string | null
          assetCost: number | null
        }) => ({
          'Asset Tag ID': lease.assetTagId,
          'Description': lease.description,
          'Category': lease.category || 'N/A',
          'Sub-Category': lease.subCategory || 'N/A',
          'Lessee': lease.lessee,
          'Lease Start Date': lease.leaseStartDate.split('T')[0],
          'Lease End Date': lease.leaseEndDate ? lease.leaseEndDate.split('T')[0] : 'N/A',
          'Status': lease.leaseStatus,
          'Days Remaining': lease.daysRemaining !== null ? lease.daysRemaining : 'N/A',
          'Location': lease.location || 'N/A',
          'Site': lease.site || 'N/A',
          'Asset Cost': formatNumber(lease.assetCost),
        }))
        const leaseSheet = XLSX.utils.json_to_sheet(leaseData)
        XLSX.utils.book_append_sheet(workbook, leaseSheet, 'Lease List')
      }

      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="lease-report-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      })
    }

    // PDF format - return error for now (can be implemented later)
    return NextResponse.json(
      { error: 'PDF export not yet implemented for lease reports' },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error exporting lease reports:', error)
    return NextResponse.json(
      { error: 'Failed to export lease reports' },
      { status: 500 }
    )
  }
}

