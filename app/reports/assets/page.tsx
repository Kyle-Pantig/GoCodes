'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { useCategories, useSubCategories } from '@/hooks/use-categories'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FileText, MoreHorizontal, Trash2, Eye, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface AssetReport {
  id: string
  reportName: string
  reportType: string
  description: string | null
  category: { id: string; name: string } | null
  subCategory: { id: string; name: string } | null
  status: string | null
  location: string | null
  department: string | null
  site: string | null
  minCost: number | null
  maxCost: number | null
  purchaseDateFrom: string | null
  purchaseDateTo: string | null
  dateAcquiredFrom: string | null
  dateAcquiredTo: string | null
  includeDepreciableOnly: boolean
  depreciationMethod: string | null
  groupBy: string | null
  sortBy: string | null
  sortOrder: string | null
  fieldsToInclude: string | null
  userId: string
  generatedAt: string
  reportStatus: string
  reportData: string | null
  filePath: string | null
  fileFormat: string | null
  totalAssets: number | null
  totalValue: number | null
  averageCost: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

async function fetchReports(
  page: number = 1,
  pageSize: number = 10,
  status?: string,
  type?: string
): Promise<{ reports: AssetReport[]; pagination: PaginationInfo }> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  })
  if (status && status !== 'all') params.append('status', status)
  if (type && type !== 'all') params.append('type', type)

  const response = await fetch(`/api/reports/assets?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch asset reports')
  }
  return response.json()
}

async function fetchUniqueStatuses(): Promise<string[]> {
  const response = await fetch('/api/assets?statuses=true')
  if (!response.ok) {
    throw new Error('Failed to fetch statuses')
  }
  const data = await response.json()
  return data.statuses || []
}

export default function AssetReportsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()

  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10)
  const statusFilter = searchParams.get('status') || 'all'
  const typeFilter = searchParams.get('type') || 'all'

  // Form state
  const [formData, setFormData] = useState({
    reportName: '',
    reportType: '',
    description: '',
    categoryId: 'all',
    subCategoryId: 'all',
    status: 'all',
    location: '',
    department: '',
    site: '',
    minCost: '',
    maxCost: '',
    purchaseDateFrom: '',
    purchaseDateTo: '',
    dateAcquiredFrom: '',
    dateAcquiredTo: '',
    includeDepreciableOnly: false,
    depreciationMethod: 'all',
    groupBy: 'all',
    sortBy: 'all',
    sortOrder: 'asc',
    fieldsToInclude: [] as string[],
    notes: '',
  })


  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')
      const data = await response.json()
      return data.categories as Array<{ id: string; name: string }>
    },
    enabled: canViewAssets,
    staleTime: 10 * 60 * 1000,
  })

  // Fetch subcategories when category is selected
  const { data: subCategoriesData } = useSubCategories(formData.categoryId || null)

  // Fetch unique statuses
  const { data: statusesData } = useQuery({
    queryKey: ['asset-statuses'],
    queryFn: fetchUniqueStatuses,
    enabled: canViewAssets,
    staleTime: 10 * 60 * 1000,
  })

  // Update URL parameters
  const updateURL = useCallback((updates: { page?: number; pageSize?: number; status?: string; type?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (updates.page !== undefined) {
      if (updates.page === 1) {
        params.delete('page')
      } else {
        params.set('page', updates.page.toString())
      }
    }
    
    if (updates.pageSize !== undefined) {
      if (updates.pageSize === 10) {
        params.delete('pageSize')
      } else {
        params.set('pageSize', updates.pageSize.toString())
      }
    }
    
    if (updates.status !== undefined) {
      if (updates.status === 'all') {
        params.delete('status')
      } else {
        params.set('status', updates.status)
      }
      params.delete('page')
    }
    
    if (updates.type !== undefined) {
      if (updates.type === 'all') {
        params.delete('type')
      } else {
        params.set('type', updates.type)
      }
      params.delete('page')
    }
    
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }, [searchParams, router, startTransition])

  // Fetch reports with React Query
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['asset-reports', page, pageSize, statusFilter, typeFilter],
    queryFn: () => fetchReports(page, pageSize, statusFilter !== 'all' ? statusFilter : undefined, typeFilter !== 'all' ? typeFilter : undefined),
    enabled: canViewAssets,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const reports = data?.reports || []
  const pagination = data?.pagination

  // Create report mutation
  const createMutation = useMutation({
    mutationFn: async (reportData: Partial<AssetReport>) => {
      const response = await fetch('/api/reports/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create report')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-reports'] })
      // Reset form
      setFormData({
        reportName: '',
        reportType: '',
        description: '',
        categoryId: 'all',
        subCategoryId: 'all',
        status: 'all',
        location: '',
        department: '',
        site: '',
        minCost: '',
        maxCost: '',
        purchaseDateFrom: '',
        purchaseDateTo: '',
        dateAcquiredFrom: '',
        dateAcquiredTo: '',
        includeDepreciableOnly: false,
        depreciationMethod: 'all',
        groupBy: 'all',
        sortBy: 'all',
        sortOrder: 'asc',
        fieldsToInclude: [],
        notes: '',
      })
      toast.success('Report created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create report')
    },
  })

  // Delete report mutation
  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/reports/assets/${reportId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete report')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-reports'] })
      toast.success('Report deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete report')
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!formData.reportName || !formData.reportType) {
      toast.error('Please fill in report name and type')
      return
    }

    createMutation.mutate({
      reportName: formData.reportName,
      reportType: formData.reportType,
      description: formData.description || null,
      categoryId: formData.categoryId === 'all' ? null : formData.categoryId || null,
      subCategoryId: formData.subCategoryId === 'all' ? null : formData.subCategoryId || null,
      status: formData.status === 'all' ? null : formData.status || null,
      location: formData.location || null,
      department: formData.department || null,
      site: formData.site || null,
      minCost: formData.minCost ? parseFloat(formData.minCost) : null,
      maxCost: formData.maxCost ? parseFloat(formData.maxCost) : null,
      purchaseDateFrom: formData.purchaseDateFrom || null,
      purchaseDateTo: formData.purchaseDateTo || null,
      dateAcquiredFrom: formData.dateAcquiredFrom || null,
      dateAcquiredTo: formData.dateAcquiredTo || null,
      includeDepreciableOnly: formData.includeDepreciableOnly,
      depreciationMethod: formData.depreciationMethod === 'all' ? null : formData.depreciationMethod || null,
      groupBy: formData.groupBy === 'all' ? null : formData.groupBy || null,
      sortBy: formData.sortBy === 'all' ? null : formData.sortBy || null,
      sortOrder: formData.sortOrder || 'asc',
      fieldsToInclude: formData.fieldsToInclude.length > 0 ? JSON.stringify(formData.fieldsToInclude) : null,
      notes: formData.notes || null,
    } as any)
  }

  const handlePageChange = (newPage: number) => {
    updateURL({ page: newPage })
  }

  const handlePageSizeChange = (newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      category: 'Category',
      location: 'Location',
      cost: 'Cost',
      depreciation: 'Depreciation',
      custom: 'Custom',
    }
    return labels[type] || type
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'outline',
      saved: 'secondary',
      generated: 'default',
      archived: 'secondary',
    }
    return variants[status] || 'outline'
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(value)
  }

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!canViewAssets) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <FileText className="h-12 w-12 text-muted-foreground opacity-50" />
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view asset reports. Please contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Asset Reports</h1>
        <p className="text-muted-foreground">
          Generate and view comprehensive asset reports
        </p>
      </div>

      {/* Create Report Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Report</CardTitle>
          <CardDescription>
            Configure your asset report with filters and options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reportName" className="mb-2 block">Report Name *</Label>
                  <Input
                    id="reportName"
                    value={formData.reportName}
                    onChange={(e) => setFormData({ ...formData, reportName: e.target.value })}
                    placeholder="e.g., Assets by Category - Q4 2024"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="reportType" className="mb-2 block">Report Type *</Label>
                  <Select
                    value={formData.reportType}
                    onValueChange={(value) => setFormData({ ...formData, reportType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="location">Location</SelectItem>
                      <SelectItem value="cost">Cost</SelectItem>
                      <SelectItem value="depreciation">Depreciation</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="description" className="mb-2 block">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="categoryId" className="mb-2 block">Category</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => setFormData({ ...formData, categoryId: value, subCategoryId: 'all' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categoriesData?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="subCategoryId" className="mb-2 block">Sub Category</Label>
                  <Select
                    value={formData.subCategoryId}
                    onValueChange={(value) => setFormData({ ...formData, subCategoryId: value })}
                    disabled={!formData.categoryId || formData.categoryId === 'all'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Sub Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sub Categories</SelectItem>
                      {subCategoriesData?.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status" className="mb-2 block">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {statusesData?.map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location" className="mb-2 block">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Filter by location"
                  />
                </div>
                <div>
                  <Label htmlFor="department" className="mb-2 block">Department</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Filter by department"
                  />
                </div>
                <div>
                  <Label htmlFor="site" className="mb-2 block">Site</Label>
                  <Input
                    id="site"
                    value={formData.site}
                    onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                    placeholder="Filter by site"
                  />
                </div>
              </div>
            </div>

            {/* Cost Range */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Cost Range</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minCost" className="mb-2 block">Minimum Cost</Label>
                  <Input
                    id="minCost"
                    type="number"
                    step="0.01"
                    value={formData.minCost}
                    onChange={(e) => setFormData({ ...formData, minCost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="maxCost" className="mb-2 block">Maximum Cost</Label>
                  <Input
                    id="maxCost"
                    type="number"
                    step="0.01"
                    value={formData.maxCost}
                    onChange={(e) => setFormData({ ...formData, maxCost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Date Ranges */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Date Ranges</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="purchaseDateFrom" className="mb-2 block">Purchase Date From</Label>
                  <Input
                    id="purchaseDateFrom"
                    type="date"
                    value={formData.purchaseDateFrom}
                    onChange={(e) => setFormData({ ...formData, purchaseDateFrom: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="purchaseDateTo" className="mb-2 block">Purchase Date To</Label>
                  <Input
                    id="purchaseDateTo"
                    type="date"
                    value={formData.purchaseDateTo}
                    onChange={(e) => setFormData({ ...formData, purchaseDateTo: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="dateAcquiredFrom" className="mb-2 block">Date Acquired From</Label>
                  <Input
                    id="dateAcquiredFrom"
                    type="date"
                    value={formData.dateAcquiredFrom}
                    onChange={(e) => setFormData({ ...formData, dateAcquiredFrom: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="dateAcquiredTo" className="mb-2 block">Date Acquired To</Label>
                  <Input
                    id="dateAcquiredTo"
                    type="date"
                    value={formData.dateAcquiredTo}
                    onChange={(e) => setFormData({ ...formData, dateAcquiredTo: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Depreciation */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Depreciation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="includeDepreciableOnly"
                    checked={formData.includeDepreciableOnly}
                    onChange={(e) => setFormData({ ...formData, includeDepreciableOnly: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="includeDepreciableOnly" className="block cursor-pointer">
                    Include Depreciable Assets Only
                  </Label>
                </div>
                <div>
                  <Label htmlFor="depreciationMethod" className="mb-2 block">Depreciation Method</Label>
                  <Select
                    value={formData.depreciationMethod}
                    onValueChange={(value) => setFormData({ ...formData, depreciationMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Methods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="straight-line">Straight Line</SelectItem>
                      <SelectItem value="declining-balance">Declining Balance</SelectItem>
                      <SelectItem value="sum-of-years">Sum of Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Report Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Report Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="groupBy" className="mb-2 block">Group By</Label>
                  <Select
                    value={formData.groupBy}
                    onValueChange={(value) => setFormData({ ...formData, groupBy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No Grouping" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">No Grouping</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="location">Location</SelectItem>
                      <SelectItem value="department">Department</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="cost_range">Cost Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sortBy" className="mb-2 block">Sort By</Label>
                  <Select
                    value={formData.sortBy}
                    onValueChange={(value) => setFormData({ ...formData, sortBy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Default</SelectItem>
                      <SelectItem value="cost">Cost</SelectItem>
                      <SelectItem value="purchaseDate">Purchase Date</SelectItem>
                      <SelectItem value="assetTagId">Asset Tag ID</SelectItem>
                      <SelectItem value="description">Description</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sortOrder" className="mb-2 block">Sort Order</Label>
                  <Select
                    value={formData.sortOrder}
                    onValueChange={(value) => setFormData({ ...formData, sortOrder: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes" className="mb-2 block">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Creating...
                  </>
                ) : (
                  'Create Report'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Reports History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Report History</CardTitle>
              <CardDescription>
                {pagination?.total || 0} report{pagination?.total !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching || isLoading}
              className="h-8 w-8"
              title="Refresh reports"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-8 w-8" />
                <p className="text-sm text-muted-foreground">Loading reports...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-lg font-medium text-destructive">Error loading reports</p>
                <p className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : 'Failed to load asset reports'}
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Try Again
                </Button>
              </div>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-base mb-1">No reports found</p>
              <p className="text-sm">Create your first asset report to get started</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Total Assets</TableHead>
                      <TableHead>Total Value</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.reportName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getReportTypeLabel(report.reportType)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadge(report.reportStatus)}>
                            {report.reportStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {report.category?.name || '-'}
                          {report.subCategory && ` / ${report.subCategory.name}`}
                        </TableCell>
                        <TableCell>{report.totalAssets ?? '-'}</TableCell>
                        <TableCell>{formatCurrency(report.totalValue)}</TableCell>
                        <TableCell>
                          {report.generatedAt
                            ? format(new Date(report.generatedAt), 'MMM dd, yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm(`Delete report "${report.reportName}"?`)) {
                                    deleteMutation.mutate(report.id)
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-4 border-t">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!pagination.hasPreviousPage || isLoading}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2 text-sm">
                      <span>Page</span>
                      <span className="font-medium">{page}</span>
                      <span>of</span>
                      <span className="font-medium">{pagination.totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={!pagination.hasNextPage || isLoading}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={isLoading}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 per page</SelectItem>
                      <SelectItem value="25">25 per page</SelectItem>
                      <SelectItem value="50">50 per page</SelectItem>
                      <SelectItem value="100">100 per page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
