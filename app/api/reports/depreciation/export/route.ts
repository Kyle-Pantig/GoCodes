import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-utils'
import * as XLSX from 'xlsx'

type DepreciationMethodStats = {
  count: number
  totalCost: number
  totalDepreciation: number
  totalCurrentValue: number
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const includeAssetList = searchParams.get('includeAssetList') === 'true'
    
    // Build query params for the depreciation report API
    const params = new URLSearchParams()
    const category = searchParams.get('category')
    const depreciationMethod = searchParams.get('depreciationMethod')
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const isDepreciable = searchParams.get('isDepreciable')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    if (category) params.set('category', category)
    if (depreciationMethod) params.set('depreciationMethod', depreciationMethod)
    if (location) params.set('location', location)
    if (site) params.set('site', site)
    if (isDepreciable) params.set('isDepreciable', isDepreciable)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    
    // If including asset list, fetch all assets (not just current page)
    if (includeAssetList) {
      params.set('pageSize', '10000')
    }

    // Fetch depreciation report data
    const baseUrl = request.nextUrl.origin
    const response = await fetch(`${baseUrl}/api/reports/depreciation?${params.toString()}`, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch depreciation data')
    }

    const data = await response.json()
    const assets = data.assets || []

    // Calculate summary statistics
    const depreciableAssets = assets.filter((a: { isDepreciable: boolean }) => a.isDepreciable)
    const totalOriginalCost = assets.reduce((sum: number, a: { originalCost: number | null }) => sum + (a.originalCost || 0), 0)
    const totalDepreciableCost = depreciableAssets.reduce((sum: number, a: { depreciableCost: number | null }) => sum + (a.depreciableCost || 0), 0)
    const totalAccumulatedDepreciation = depreciableAssets.reduce((sum: number, a: { accumulatedDepreciation: number }) => sum + a.accumulatedDepreciation, 0)
    const totalCurrentValue = depreciableAssets.reduce((sum: number, a: { currentValue: number }) => sum + a.currentValue, 0)
    const totalAnnualDepreciation = depreciableAssets.reduce((sum: number, a: { annualDepreciation: number }) => sum + a.annualDepreciation, 0)

    const byMethod = depreciableAssets.reduce((acc: Record<string, DepreciationMethodStats>, asset: { depreciationMethod: string | null; depreciableCost: number | null; accumulatedDepreciation: number; currentValue: number }) => {
      const method = asset.depreciationMethod || 'Not Specified'
      if (!acc[method]) {
        acc[method] = {
          count: 0,
          totalCost: 0,
          totalDepreciation: 0,
          totalCurrentValue: 0,
        }
      }
      acc[method].count++
      acc[method].totalCost += asset.depreciableCost || 0
      acc[method].totalDepreciation += asset.accumulatedDepreciation
      acc[method].totalCurrentValue += asset.currentValue
      return acc
    }, {})

    // Helper function to format numbers with commas (no currency symbol for CSV/Excel)
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
      
      if (includeAssetList) {
        // Include summary and asset list
        csvContent += 'DEPRECIATION REPORT SUMMARY\n'
        csvContent += `Total Assets,${assets.length}\n`
        csvContent += `Depreciable Assets,${depreciableAssets.length}\n`
        csvContent += `Total Original Cost,${formatNumber(totalOriginalCost)}\n`
        csvContent += `Total Depreciable Cost,${formatNumber(totalDepreciableCost)}\n`
        csvContent += `Accumulated Depreciation,${formatNumber(totalAccumulatedDepreciation)}\n`
        csvContent += `Total Current Value,${formatNumber(totalCurrentValue)}\n`
        csvContent += `Total Annual Depreciation,${formatNumber(totalAnnualDepreciation)}\n\n`
        
        csvContent += 'DEPRECIATION BY METHOD\n'
        csvContent += 'Method,Asset Count,Total Cost,Accumulated Depreciation,Current Value\n'
        ;(Object.entries(byMethod) as [string, DepreciationMethodStats][]).forEach(([method, stats]) => {
          csvContent += `${method},${stats.count},${formatNumber(stats.totalCost)},${formatNumber(stats.totalDepreciation)},${formatNumber(stats.totalCurrentValue)}\n`
        })
        csvContent += '\n'
        
        csvContent += 'ASSET DEPRECIATION DETAILS\n'
        const headers = [
          'Asset Tag ID',
          'Description',
          'Category',
          'Depreciation Method',
          'Original Cost',
          'Depreciable Cost',
          'Salvage Value',
          'Asset Life (Months)',
          'Date Acquired',
          'Monthly Depreciation',
          'Annual Depreciation',
          'Accumulated Depreciation',
          'Current Value',
        ]
        csvContent += headers.join(',') + '\n'
        assets.forEach((asset: {
          assetTagId: string
          description: string
          category: string | null
          depreciationMethod: string | null
          originalCost: number | null
          depreciableCost: number | null
          salvageValue: number | null
          assetLifeMonths: number | null
          dateAcquired: string | null
          monthlyDepreciation: number
          annualDepreciation: number
          accumulatedDepreciation: number
          currentValue: number
        }) => {
          csvContent += [
            asset.assetTagId,
            `"${asset.description}"`,
            asset.category || 'N/A',
            asset.depreciationMethod || 'N/A',
            formatNumber(asset.originalCost),
            formatNumber(asset.depreciableCost),
            formatNumber(asset.salvageValue),
            asset.assetLifeMonths || 'N/A',
            asset.dateAcquired || 'N/A',
            formatNumber(asset.monthlyDepreciation),
            formatNumber(asset.annualDepreciation),
            formatNumber(asset.accumulatedDepreciation),
            formatNumber(asset.currentValue),
          ].join(',') + '\n'
        })
      } else {
        // Summary only
        csvContent += 'DEPRECIATION REPORT SUMMARY\n'
        csvContent += `Total Assets,${assets.length}\n`
        csvContent += `Depreciable Assets,${depreciableAssets.length}\n`
        csvContent += `Total Original Cost,${formatNumber(totalOriginalCost)}\n`
        csvContent += `Total Depreciable Cost,${formatNumber(totalDepreciableCost)}\n`
        csvContent += `Accumulated Depreciation,${formatNumber(totalAccumulatedDepreciation)}\n`
        csvContent += `Total Current Value,${formatNumber(totalCurrentValue)}\n`
        csvContent += `Total Annual Depreciation,${formatNumber(totalAnnualDepreciation)}\n\n`
        csvContent += 'DEPRECIATION BY METHOD\n'
        csvContent += 'Method,Asset Count,Total Cost,Accumulated Depreciation,Current Value\n'
        ;(Object.entries(byMethod) as [string, DepreciationMethodStats][]).forEach(([method, stats]) => {
          csvContent += `${method},${stats.count},${formatNumber(stats.totalCost)},${formatNumber(stats.totalDepreciation)},${formatNumber(stats.totalCurrentValue)}\n`
        })
      }

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="depreciation-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    if (format === 'excel') {
      const workbook = XLSX.utils.book_new()

      // Summary sheet
      const summaryData = [
        ['DEPRECIATION REPORT SUMMARY'],
        ['Total Assets', assets.length],
        ['Depreciable Assets', depreciableAssets.length],
        ['Total Original Cost', formatNumber(totalOriginalCost)],
        ['Total Depreciable Cost', formatNumber(totalDepreciableCost)],
        ['Accumulated Depreciation', formatNumber(totalAccumulatedDepreciation)],
        ['Total Current Value', formatNumber(totalCurrentValue)],
        ['Total Annual Depreciation', formatNumber(totalAnnualDepreciation)],
        [],
        ['DEPRECIATION BY METHOD'],
        ['Method', 'Asset Count', 'Total Cost', 'Accumulated Depreciation', 'Current Value'],
        ...(Object.entries(byMethod) as [string, DepreciationMethodStats][]).map(([method, stats]) => [
          method,
          stats.count,
          formatNumber(stats.totalCost),
          formatNumber(stats.totalDepreciation),
          formatNumber(stats.totalCurrentValue),
        ]),
      ]
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

      if (includeAssetList) {
        // Asset list sheet
        const assetData = assets.map((asset: {
          assetTagId: string
          description: string
          category: string | null
          depreciationMethod: string | null
          originalCost: number | null
          depreciableCost: number | null
          salvageValue: number | null
          assetLifeMonths: number | null
          dateAcquired: string | null
          monthlyDepreciation: number
          annualDepreciation: number
          accumulatedDepreciation: number
          currentValue: number
        }) => ({
          'Asset Tag ID': asset.assetTagId,
          'Description': asset.description,
          'Category': asset.category || 'N/A',
          'Depreciation Method': asset.depreciationMethod || 'N/A',
          'Original Cost': formatNumber(asset.originalCost),
          'Depreciable Cost': formatNumber(asset.depreciableCost),
          'Salvage Value': formatNumber(asset.salvageValue),
          'Asset Life (Months)': asset.assetLifeMonths,
          'Date Acquired': asset.dateAcquired || 'N/A',
          'Monthly Depreciation': formatNumber(asset.monthlyDepreciation),
          'Annual Depreciation': formatNumber(asset.annualDepreciation),
          'Accumulated Depreciation': formatNumber(asset.accumulatedDepreciation),
          'Current Value': formatNumber(asset.currentValue),
        }))
        const assetSheet = XLSX.utils.json_to_sheet(assetData)
        XLSX.utils.book_append_sheet(workbook, assetSheet, 'Asset List')
      }

      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="depreciation-report-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      })
    }

    // PDF format - return error for now (can be implemented later)
    return NextResponse.json(
      { error: 'PDF export not yet implemented for depreciation reports' },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error exporting depreciation reports:', error)
    return NextResponse.json(
      { error: 'Failed to export depreciation reports' },
      { status: 500 }
    )
  }
}

