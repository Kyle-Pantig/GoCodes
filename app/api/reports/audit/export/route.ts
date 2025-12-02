import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const includeAuditList = searchParams.get('includeAuditList') === 'true'
    
    // Parse filters (same as main route)
    const category = searchParams.get('category')
    const auditType = searchParams.get('auditType')
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const auditor = searchParams.get('auditor')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Build where clause (same as main route)
    const where: Prisma.AssetsAuditHistoryWhereInput = {
      asset: {
        isDeleted: false,
      },
    }

    if (category) {
      where.asset = {
        ...where.asset,
        category: {
          name: category,
        },
      } as Prisma.AssetsWhereInput
    }

    if (auditType) {
      where.auditType = auditType
    }

    if (location) {
      where.asset = {
        ...where.asset,
        location: location,
      } as Prisma.AssetsWhereInput
    }

    if (site) {
      where.asset = {
        ...where.asset,
        site: site,
      } as Prisma.AssetsWhereInput
    }

    if (auditor) {
      where.auditor = {
        contains: auditor,
        mode: 'insensitive',
      }
    }

    if (startDate || endDate) {
      where.auditDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    // Fetch all audits (or limited if not including list)
    const pageSize = includeAuditList ? 10000 : 1
    const audits = await retryDbOperation(() =>
      prisma.assetsAuditHistory.findMany({
        where,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
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
            },
          },
        },
        orderBy: {
          auditDate: 'desc',
        },
        take: pageSize,
      })
    )

    // Calculate summary statistics
    const totalAudits = audits.length
    const uniqueAuditTypes = new Set(audits.map(a => a.auditType))
    const auditsByType = Array.from(uniqueAuditTypes).map(type => {
      const typeAudits = audits.filter(a => a.auditType === type)
      return {
        auditType: type,
        count: typeAudits.length,
      }
    })

    // Format audit data
    const formattedAudits = audits.map((audit) => ({
      'Asset Tag ID': audit.asset.assetTagId,
      'Category': audit.asset.category?.name || 'N/A',
      'Sub-Category': audit.asset.subCategory?.name || 'N/A',
      'Audit Type': audit.auditType,
      'Audited to Site': audit.asset.site || 'N/A',
      'Audited to Location': audit.asset.location || 'N/A',
      'Last Audit Date': audit.auditDate.toISOString().split('T')[0],
      'Audit By': audit.auditor || 'N/A',
    }))

    if (format === 'csv') {
      let csvContent = ''
      
      if (includeAuditList) {
        // Include summary and audit list
        csvContent += 'AUDIT REPORT SUMMARY\n'
        csvContent += `Total Audits,${totalAudits}\n`
        csvContent += `Unique Audit Types,${uniqueAuditTypes.size}\n\n`
        
        csvContent += 'AUDITS BY TYPE\n'
        csvContent += 'Audit Type,Count\n'
        auditsByType.forEach(item => {
          csvContent += `${item.auditType},${item.count}\n`
        })
        csvContent += '\n'
        
        csvContent += 'AUDIT RECORDS\n'
        const headers = Object.keys(formattedAudits[0] || {})
        csvContent += headers.join(',') + '\n'
        formattedAudits.forEach(audit => {
          csvContent += Object.values(audit).map(v => `"${v}"`).join(',') + '\n'
        })
      } else {
        // Summary only
        csvContent += 'AUDIT REPORT SUMMARY\n'
        csvContent += `Total Audits,${totalAudits}\n`
        csvContent += `Unique Audit Types,${uniqueAuditTypes.size}\n\n`
        csvContent += 'AUDITS BY TYPE\n'
        csvContent += 'Audit Type,Count\n'
        auditsByType.forEach(item => {
          csvContent += `${item.auditType},${item.count}\n`
        })
      }

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    if (format === 'excel') {
      const workbook = XLSX.utils.book_new()

      // Summary sheet
      const summaryData = [
        ['AUDIT REPORT SUMMARY'],
        ['Total Audits', totalAudits],
        ['Unique Audit Types', uniqueAuditTypes.size],
        [],
        ['AUDITS BY TYPE'],
        ['Audit Type', 'Count'],
        ...auditsByType.map(item => [item.auditType, item.count]),
      ]
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

      if (includeAuditList) {
        // Audit list sheet
        const auditSheet = XLSX.utils.json_to_sheet(formattedAudits)
        XLSX.utils.book_append_sheet(workbook, auditSheet, 'Audit List')
      }

      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="audit-report-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      })
    }

    // PDF format - return error for now (can be implemented later)
    return NextResponse.json(
      { error: 'PDF export not yet implemented for audit reports' },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error exporting audit reports:', error)
    return NextResponse.json(
      { error: 'Failed to export audit reports' },
      { status: 500 }
    )
  }
}

