import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from '@/lib/supabase-client'

// Asset interfaces
export interface CategoryInfo {
  id: string
  name: string
}

export interface SubCategoryInfo {
  id: string
  name: string
}

export interface EmployeeInfo {
  id: string
  name: string
  email: string
}

export interface CheckoutInfo {
  id: string
  checkoutDate: Date
  expectedReturnDate: Date | null
  employeeUser: EmployeeInfo | null
}

export interface LeaseInfo {
  id: string
  leaseStartDate: Date
  leaseEndDate: Date | null
  lessee: string | null
}

export interface AuditHistoryInfo {
  id: string
  auditDate: Date
  auditType: string | null
  auditor: string | null
}

export interface Asset {
  id: string
  assetTagId: string
  description: string
  purchasedFrom: string | null
  purchaseDate: Date | null
  brand: string | null
  cost: number | null
  model: string | null
  serialNo: string | null
  additionalInformation: string | null
  xeroAssetNo: string | null
  owner: string | null
  pbiNumber: string | null
  status: string | null
  issuedTo: string | null
  poNumber: string | null
  paymentVoucherNumber: string | null
  assetType: string | null
  deliveryDate: Date | null
  unaccountedInventory: boolean
  remarks: string | null
  qr: string | null
  oldAssetTag: string | null
  depreciableAsset: boolean
  depreciableCost: number | null
  salvageValue: number | null
  assetLifeMonths: number | null
  depreciationMethod: string | null
  dateAcquired: Date | null
  categoryId: string | null
  category: CategoryInfo | null
  subCategoryId: string | null
  subCategory: SubCategoryInfo | null
  department: string | null
  site: string | null
  location: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  isDeleted: boolean
  checkouts: CheckoutInfo[] | null
  leases: LeaseInfo[] | null
  auditHistory: AuditHistoryInfo[] | null
  imagesCount: number
}

export interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface SummaryInfo {
  totalAssets: number
  totalValue: number
  availableAssets: number
  checkedOutAssets: number
}

export interface AssetsResponse {
  assets: Asset[]
  pagination: PaginationInfo
  summary: SummaryInfo
}

export interface AssetResponse {
  asset: Asset
}

export interface StatusesResponse {
  statuses: string[]
}

export interface AssetCreateData {
  assetTagId: string
  description: string
  purchasedFrom?: string | null
  purchaseDate?: string | null
  brand?: string | null
  cost?: number | null
  model?: string | null
  serialNo?: string | null
  additionalInformation?: string | null
  xeroAssetNo?: string | null
  owner?: string | null
  pbiNumber?: string | null
  status?: string
  issuedTo?: string | null
  poNumber?: string | null
  paymentVoucherNumber?: string | null
  assetType?: string | null
  deliveryDate?: string | null
  unaccountedInventory?: boolean
  remarks?: string | null
  qr?: string | null
  oldAssetTag?: string | null
  depreciableAsset?: boolean
  depreciableCost?: number | null
  salvageValue?: number | null
  assetLifeMonths?: number | null
  depreciationMethod?: string | null
  dateAcquired?: string | null
  categoryId?: string | null
  subCategoryId?: string | null
  department?: string | null
  site?: string | null
  location?: string | null
}

// Get API base URL - use FastAPI if enabled
const getApiBaseUrl = () => {
  const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
  const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
  return useFastAPI ? fastApiUrl : ''
}

// Helper function to get auth token from Supabase session
async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Failed to get auth token:', error)
      return null
    }
    if (!session?.access_token) {
      console.warn('No active session found')
      return null
    }
    return session.access_token
  } catch (error) {
    console.error('Failed to get auth token:', error)
    return null
  }
}

// Helper to convert date strings to Date objects
function convertAssetDates(asset: any): Asset {
  return {
    ...asset,
    purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : null,
    deliveryDate: asset.deliveryDate ? new Date(asset.deliveryDate) : null,
    dateAcquired: asset.dateAcquired ? new Date(asset.dateAcquired) : null,
    createdAt: new Date(asset.createdAt),
    updatedAt: new Date(asset.updatedAt),
    deletedAt: asset.deletedAt ? new Date(asset.deletedAt) : null,
    checkouts: asset.checkouts?.map((chk: any) => ({
      ...chk,
      checkoutDate: new Date(chk.checkoutDate),
      expectedReturnDate: chk.expectedReturnDate ? new Date(chk.expectedReturnDate) : null,
    })) || null,
    leases: asset.leases?.map((lease: any) => ({
      ...lease,
      leaseStartDate: new Date(lease.leaseStartDate),
      leaseEndDate: lease.leaseEndDate ? new Date(lease.leaseEndDate) : null,
    })) || null,
    auditHistory: asset.auditHistory?.map((audit: any) => ({
      ...audit,
      auditDate: new Date(audit.auditDate),
    })) || null,
  }
}

// Fetch assets with pagination and filters
export const useAssets = (
  enabled: boolean = true,
  search?: string,
  category?: string,
  status?: string,
  page: number = 1,
  pageSize: number = 50,
  withMaintenance: boolean = false,
  includeDeleted: boolean = false,
  searchFields?: string,
  statusesOnly: boolean = false,
  summaryOnly: boolean = false
) => {
  return useQuery<AssetsResponse>({
    queryKey: ["assets", search, category, status, page, pageSize, withMaintenance, includeDeleted, searchFields, statusesOnly, summaryOnly],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })
      if (search) params.append('search', search)
      if (category && category !== 'all') params.append('category', category)
      if (status && status !== 'all') params.append('status', status)
      if (withMaintenance) params.append('withMaintenance', 'true')
      if (includeDeleted) params.append('includeDeleted', 'true')
      if (searchFields) params.append('searchFields', searchFields)
      if (statusesOnly) params.append('statuses', 'true')
      if (summaryOnly) params.append('summary', 'true')
      
      const url = `${baseUrl}/api/assets?${params.toString()}`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to fetch assets: ${response.status} ${response.statusText}`, errorText)
        if (response.status === 401) {
          throw new Error('Unauthorized - please login again')
        }
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.detail || errorData.error || 'Failed to fetch assets')
        } catch {
          throw new Error('Failed to fetch assets')
        }
      }
      
      const data = await response.json()
      
      // Convert date strings to Date objects
      const assetsWithDates = (data.assets || []).map(convertAssetDates)
      
      return {
        ...data,
        assets: assetsWithDates,
      } as AssetsResponse
    },
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Fetch a single asset by ID
export const useAsset = (assetId: string | null, enabled: boolean = true) => {
  return useQuery<Asset | null>({
    queryKey: ["asset", assetId],
    queryFn: async () => {
      if (!assetId) return null
      
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/${assetId}`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to fetch asset: ${response.status} ${response.statusText}`, errorText)
        if (response.status === 401) {
          throw new Error('Unauthorized - please login again')
        }
        if (response.status === 404) {
          return null
        }
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.detail || errorData.error || 'Failed to fetch asset')
        } catch {
          throw new Error('Failed to fetch asset')
        }
      }
      
      const data = await response.json()
      return convertAssetDates(data.asset)
    },
    enabled: enabled && !!assetId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Fetch assets summary
export const useAssetsSummary = (enabled: boolean = true) => {
  return useQuery<{ summary: SummaryInfo }>({
    queryKey: ["assets-summary"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets?summary=true&pageSize=1`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to fetch assets summary: ${response.status} ${response.statusText}`, errorText)
        if (response.status === 401) {
          throw new Error('Unauthorized - please login again')
        }
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.detail || errorData.error || 'Failed to fetch assets summary')
        } catch {
          throw new Error('Failed to fetch assets summary')
        }
      }
      
      return await response.json()
    },
    enabled,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Fetch unique asset statuses
export const useAssetsStatuses = (enabled: boolean = true) => {
  return useQuery<StatusesResponse>({
    queryKey: ["assets", "statuses"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const params = new URLSearchParams({
        statuses: "true",
      })
      
      const url = `${baseUrl}/api/assets?${params.toString()}`
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(url, { credentials: 'include', headers })
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to fetch statuses: ${response.status} ${response.statusText}`, errorText)
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.detail || errorData.error || "Failed to fetch statuses")
        } catch {
          throw new Error("Failed to fetch statuses")
        }
      }
      const data = await response.json()
      return data
    },
    enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Search assets by query string
export const useAssetsBySearch = (
  search: string,
  enabled: boolean = true,
  pageSize: number = 50
) => {
  return useAssets(
    enabled,
    search,
    undefined,
    undefined,
    1,
    pageSize,
    false,
    false,
    undefined,
    false,
    false
  )
}

// Create asset mutation
export const useCreateAsset = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: AssetCreateData) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets`
      
      const token = await getAuthToken()
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to create asset: ${response.status} ${response.statusText}`, errorText)
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.detail || errorData.error || "Failed to create asset")
        } catch {
          throw new Error("Failed to create asset")
        }
      }
      
      const responseData = await response.json()
      return convertAssetDates(responseData.asset)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["assets-summary"] })
    },
  })
}

// Update asset mutation
export const useUpdateAsset = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...data }: AssetCreateData & { id: string }) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/${id}`
      
      const token = await getAuthToken()
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to update asset: ${response.status} ${response.statusText}`, errorText)
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.detail || errorData.error || "Failed to update asset")
        } catch {
          throw new Error("Failed to update asset")
        }
      }
      
      const responseData = await response.json()
      return convertAssetDates(responseData.asset)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["asset", data.id] })
      queryClient.invalidateQueries({ queryKey: ["assets-summary"] })
    },
  })
}

// Delete asset mutation
export const useDeleteAsset = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (assetId: string) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/${assetId}`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        method: "DELETE",
        headers,
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to delete asset: ${response.status} ${response.statusText}`, errorText)
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.detail || errorData.error || "Failed to delete asset")
        } catch {
          throw new Error("Failed to delete asset")
        }
      }
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["assets-summary"] })
    },
  })
}

// Update asset status mutation
export const useUpdateAssetStatus = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/${id}`
      
      const token = await getAuthToken()
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status }),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to update asset status: ${response.status} ${response.statusText}`, errorText)
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.detail || errorData.error || "Failed to update asset status")
        } catch {
          throw new Error("Failed to update asset status")
        }
      }
      
      const responseData = await response.json()
      return convertAssetDates(responseData.asset)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["asset", data.id] })
      queryClient.invalidateQueries({ queryKey: ["assets-summary"] })
    },
  })
}

