import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from '@/lib/supabase-client'

export interface InventoryItem {
  id: string
  itemCode: string
  name: string
  description: string | null
  category: string | null
  unit: string | null
  currentStock: number
  minStockLevel: number | null
  maxStockLevel: number | null
  unitCost: number | null
  location: string | null
  supplier: string | null
  brand: string | null
  model: string | null
  sku: string | null
  barcode: string | null
  remarks: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    transactions: number
  }
}

export interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface InventoryItemsResponse {
  items: InventoryItem[]
  pagination: PaginationInfo
}

interface CreateInventoryItemData {
  itemCode: string
  name: string
  description?: string | null
  category?: string | null
  unit?: string | null
  currentStock?: number
  minStockLevel?: number | null
  maxStockLevel?: number | null
  unitCost?: number | null
  location?: string | null
  supplier?: string | null
  brand?: string | null
  model?: string | null
  sku?: string | null
  barcode?: string | null
  remarks?: string | null
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

// Fetch inventory items
export const useInventoryItems = (params: {
  search?: string
  category?: string
  lowStock?: boolean
  page?: number
  pageSize?: number
  includeDeleted?: boolean
} = {}) => {
  return useQuery({
    queryKey: ["inventory", params.search, params.category, params.lowStock, params.page, params.pageSize, params.includeDeleted],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const queryParams = new URLSearchParams()
      if (params.search) queryParams.set('search', params.search)
      if (params.category) queryParams.set('category', params.category)
      if (params.lowStock) queryParams.set('lowStock', 'true')
      if (params.page) queryParams.set('page', params.page.toString())
      if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString())
      if (params.includeDeleted) queryParams.set('includeDeleted', 'true')

      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/inventory?${queryParams.toString()}`, {
        credentials: 'include',
        headers,
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to fetch inventory items: ${response.status} ${response.statusText}`, errorText)
        if (response.status === 401) {
          throw new Error('Unauthorized - please login again')
        }
        throw new Error('Failed to fetch inventory items')
      }
      const data = await response.json()
      return data as InventoryItemsResponse
    },
    placeholderData: (previousData) => previousData,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  })
}

// Create inventory item mutation
export const useCreateInventoryItem = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateInventoryItemData) => {
      const baseUrl = getApiBaseUrl()
      
      const token = await getAuthToken()
      const headers: HeadersInit = { 
        "Content-Type": "application/json",
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/inventory`, {
        method: "POST",
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || "Failed to create inventory item")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
    },
  })
}

// Update inventory item mutation
export const useUpdateInventoryItem = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...data }: CreateInventoryItemData & { id: string }) => {
      const baseUrl = getApiBaseUrl()
      
      const token = await getAuthToken()
      const headers: HeadersInit = { 
        "Content-Type": "application/json",
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/inventory/${id}`, {
        method: "PUT",
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || "Failed to update inventory item")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
    },
  })
}

// Delete inventory item mutation
export const useDeleteInventoryItem = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, permanent = false }: { id: string; permanent?: boolean }) => {
      const baseUrl = getApiBaseUrl()
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const url = `${baseUrl}/api/inventory/${id}${permanent ? '?permanent=true' : ''}`
      const response = await fetch(url, {
        method: "DELETE",
        headers,
        credentials: 'include',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || "Failed to delete inventory item")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
    },
  })
}

// Get single inventory item
export const useInventoryItem = (itemId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["inventory-item", itemId],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/inventory/${itemId}`, {
        credentials: 'include',
        headers,
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to fetch inventory item: ${response.status} ${response.statusText}`, errorText)
        if (response.status === 401) {
          throw new Error('Unauthorized - please login again')
        }
        throw new Error('Failed to fetch inventory item')
      }
      const data = await response.json()
      return data.item as InventoryItem
    },
    enabled: enabled && !!itemId,
    staleTime: 5 * 60 * 1000,
  })
}

// Restore inventory item mutation
export const useRestoreInventoryItem = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const baseUrl = getApiBaseUrl()
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/inventory/${id}/restore`, {
        method: "POST",
        headers,
        credentials: 'include',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || "Failed to restore inventory item")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      queryClient.invalidateQueries({ queryKey: ["deletedInventoryItems"] })
    },
  })
}

export interface InventoryTransaction {
  id: string
  inventoryItemId: string
  transactionType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
  quantity: number
  unitCost: number | null
  reference: string | null
  notes: string | null
  actionBy: string
  transactionDate: string
  relatedTransactionId: string | null
  createdAt: string
  updatedAt: string
  relatedTransaction?: InventoryTransaction | null
  inventoryItem?: {
    id: string
    itemCode: string
    name: string
  } | null
}

export interface InventoryTransactionsResponse {
  transactions: InventoryTransaction[]
  pagination: PaginationInfo
}

// Get inventory transactions
export const useInventoryTransactions = (
  itemId: string,
  params: {
    page?: number
    pageSize?: number
    type?: string
  } = {},
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ["inventory-transactions", itemId, params.page, params.pageSize, params.type],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const queryParams = new URLSearchParams()
      if (params.page) queryParams.set('page', params.page.toString())
      if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString())
      if (params.type && params.type !== 'all') queryParams.set('type', params.type)

      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/inventory/${itemId}/transactions?${queryParams.toString()}`, {
        credentials: 'include',
        headers,
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to fetch transactions: ${response.status} ${response.statusText}`, errorText)
        if (response.status === 401) {
          throw new Error('Unauthorized - please login again')
        }
        throw new Error('Failed to fetch transactions')
      }
      const data = await response.json()
      // Add hasNextPage and hasPreviousPage to match inventory pagination structure
      return {
        ...data,
        pagination: {
          ...data.pagination,
          hasNextPage: data.pagination.page < data.pagination.totalPages,
          hasPreviousPage: data.pagination.page > 1,
        },
      } as InventoryTransactionsResponse
    },
    enabled: enabled && !!itemId,
    placeholderData: (previousData) => previousData,
    staleTime: 0,
  })
}

// Create inventory transaction mutation
export const useCreateInventoryTransaction = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ itemId, data }: {
      itemId: string
      data: {
        transactionType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
        quantity: number
        unitCost?: number | null
        reference?: string | null
        notes?: string | null
        destinationItemId?: string | null
      }
    }) => {
      const baseUrl = getApiBaseUrl()
      
      const token = await getAuthToken()
      const headers: HeadersInit = { 
        "Content-Type": "application/json",
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/inventory/${itemId}/transactions`, {
        method: "POST",
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || "Failed to create transaction")
      }
      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      queryClient.invalidateQueries({ queryKey: ["inventory-transactions", variables.itemId] })
      queryClient.invalidateQueries({ queryKey: ["inventory-item", variables.itemId] })
    },
  })
}

// Bulk delete transactions mutation
export const useBulkDeleteTransactions = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ itemId, transactionIds }: { itemId: string; transactionIds: string[] }) => {
      const baseUrl = getApiBaseUrl()
      
      const token = await getAuthToken()
      const headers: HeadersInit = { 
        "Content-Type": "application/json",
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/inventory/${itemId}/transactions/bulk-delete`, {
        method: "DELETE",
        headers,
        credentials: 'include',
        body: JSON.stringify({ transactionIds }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || "Failed to delete transactions")
      }
      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transactions", variables.itemId] })
      queryClient.invalidateQueries({ queryKey: ["inventory-item", variables.itemId] })
    },
  })
}

// Bulk restore inventory items mutation
export const useBulkRestoreInventoryItems = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const baseUrl = getApiBaseUrl()
      
      const token = await getAuthToken()
      const headers: HeadersInit = { 
        "Content-Type": "application/json",
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/inventory/bulk-restore`, {
        method: "POST",
        headers,
        credentials: 'include',
        body: JSON.stringify({ ids }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || "Failed to restore items")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      queryClient.invalidateQueries({ queryKey: ["deletedInventoryItems"] })
    },
  })
}

