'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { PieChart, Pie, Cell } from 'recharts'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

type DashboardStats = {
  assetValueByCategory: Array<{ name: string; value: number }>
  activeCheckouts: Array<{
    id: string
    checkoutDate: string
    expectedReturnDate: string | null
    asset: {
      id: string
      assetTagId: string
      description: string
    }
    employeeUser: {
      id: string
      name: string
      email: string
    } | null
  }>
  recentCheckins: Array<{
    id: string
    checkinDate: string
    asset: {
      id: string
      assetTagId: string
      description: string
    }
    checkout: {
      employeeUser: {
        id: string
        name: string
        email: string
      }
    }
  }>
  assetsUnderRepair: Array<{
    id: string
    dueDate: string | null
    status: string
    asset: {
      id: string
      assetTagId: string
      description: string
    }
  }>
  summary: {
    totalActiveAssets: number
    totalValue: number
    purchasesInFiscalYear: number
    checkedOutCount: number
    availableCount: number
    checkedOutAndAvailable: number
  }
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetch('/api/dashboard/stats')
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard statistics')
  }
  return response.json()
}

// Chart colors for categories - using direct color values
const chartColors = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
]

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'checked-out' | 'checked-in' | 'under-repair'>('checked-out')

  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your asset management system
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your asset management system
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              Failed to load dashboard data. Please try again later.
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Prepare chart data and config dynamically based on categories
  const chartData = data?.assetValueByCategory.map((item, index) => {
    const categoryKey = item.name.toLowerCase().replace(/\s+/g, '-')
    const color = chartColors[index % chartColors.length]
    return {
      category: item.name,
      value: item.value,
      fill: color,
      [categoryKey]: item.value,
    }
  }) || []

  // Build dynamic chart config
  const chartConfig: ChartConfig = {
    value: {
      label: 'Value',
    },
    ...chartData.reduce((acc, item, index) => {
      const categoryKey = item.category.toLowerCase().replace(/\s+/g, '-')
      acc[categoryKey] = {
        label: item.category,
        color: chartColors[index % chartColors.length],
      }
      return acc
    }, {} as Record<string, { label: string; color: string }>),
  } satisfies ChartConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your asset management system
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Total Active Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data?.summary.checkedOutAndAvailable.toLocaleString() || '0'}/{data?.summary.totalActiveAssets.toLocaleString() || '0'}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Number of Active Assets / Total Active Assets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Total Value of Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ₱{data?.summary.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Total asset value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Purchases in Fiscal Year</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data?.summary.purchasesInFiscalYear.toLocaleString() || '0'}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Assets purchased this year
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Value by Category Chart */}
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>Asset Value by Category</CardTitle>
            <CardDescription>
              Total asset value grouped by category
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            {chartData.length > 0 ? (
              <>
                <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[400px]">
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent 
                          hideLabel 
                          formatter={(value: unknown) => {
                            const numValue = typeof value === 'number' ? value : Number(value) || 0
                            return `₱${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          }}
                        />
                      }
                    />
                    <Pie 
                      data={chartData} 
                      dataKey="value" 
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      label={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                {/* Category Legend */}
                <div className="mt-6 space-y-2">
                  <h3 className="text-sm font-medium mb-3">Categories</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {chartData.map((item, index) => (
                      <div
                        key={item.category}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div
                          className="h-4 w-4 shrink-0 rounded-sm"
                          style={{
                            backgroundColor: chartColors[index % chartColors.length],
                          }}
                        />
                        <span className="text-muted-foreground flex-1 truncate">
                          {item.category}
                        </span>
                        <span className="font-medium tabular-nums">
                          ₱{item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feeds Section */}
        <Card>
        <CardHeader>
          <CardTitle>Feeds</CardTitle>
          <CardDescription>
            Latest 10 recent asset activity and status updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b mb-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setActiveTab('checked-out')}
              className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
                activeTab === 'checked-out'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Checked Out ({data?.activeCheckouts.length || 0})
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setActiveTab('checked-in')}
              className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
                activeTab === 'checked-in'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Checked In ({data?.recentCheckins.length || 0})
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setActiveTab('under-repair')}
              className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
                activeTab === 'under-repair'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Under Repair ({data?.assetsUnderRepair.length || 0})
            </Button>
          </div>

          {/* Tab Content */}
          <div className="mt-4">
            {activeTab === 'checked-out' && (
              <div className="space-y-4">
                {data?.activeCheckouts && data.activeCheckouts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset Tag ID</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Checkout Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Assign To</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.activeCheckouts.map((checkout) => (
                        <TableRow key={checkout.id}>
                          <TableCell className="font-medium">
                            {checkout.asset.assetTagId}
                          </TableCell>
                          <TableCell>{checkout.asset.description}</TableCell>
                          <TableCell>
                            {format(new Date(checkout.checkoutDate), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            {checkout.expectedReturnDate
                              ? format(new Date(checkout.expectedReturnDate), 'MMM dd, yyyy')
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {checkout.employeeUser?.name || checkout.employeeUser?.email || 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No checked out assets
                  </div>
                )}
              </div>
            )}

            {activeTab === 'checked-in' && (
              <div className="space-y-4">
                {data?.recentCheckins && data.recentCheckins.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset Tag ID</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Return Date</TableHead>
                        <TableHead>Check In From</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentCheckins.map((checkin) => (
                        <TableRow key={checkin.id}>
                          <TableCell className="font-medium">
                            {checkin.asset.assetTagId}
                          </TableCell>
                          <TableCell>{checkin.asset.description}</TableCell>
                          <TableCell>
                            {format(new Date(checkin.checkinDate), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            {checkin.checkout.employeeUser?.name || checkin.checkout.employeeUser?.email || 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent check-ins
                  </div>
                )}
              </div>
            )}

            {activeTab === 'under-repair' && (
              <div className="space-y-4">
                {data?.assetsUnderRepair && data.assetsUnderRepair.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset Tag ID</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Scheduled Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.assetsUnderRepair.map((maintenance) => (
                        <TableRow key={maintenance.id}>
                          <TableCell className="font-medium">
                            {maintenance.asset.assetTagId}
                          </TableCell>
                          <TableCell>{maintenance.asset.description}</TableCell>
                          <TableCell>
                            {maintenance.dueDate
                              ? format(new Date(maintenance.dueDate), 'MMM dd, yyyy')
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                maintenance.status === 'In progress'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              }`}
                            >
                              {maintenance.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No assets under repair
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
