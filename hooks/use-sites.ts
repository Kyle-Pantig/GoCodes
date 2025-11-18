import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface Site {
  id: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

interface CreateSiteData {
  name: string
  description?: string | null
}

// Fetch sites
export const useSites = (enabled: boolean = true, search?: string) => {
  return useQuery({
    queryKey: ["sites", search],
    queryFn: async () => {
      const url = search
        ? `/api/sites?search=${encodeURIComponent(search)}`
        : "/api/sites"
      const response = await fetch(url)
      if (!response.ok) {
        return []
      }
      const data = await response.json()
      return (data.sites || []) as Site[]
    },
    enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Create site mutation
export const useCreateSite = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateSiteData) => {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create site")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] })
    },
  })
}

// Update site mutation
export const useUpdateSite = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...data }: CreateSiteData & { id: string }) => {
      const response = await fetch(`/api/sites/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update site")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] })
    },
  })
}

// Delete site mutation
export const useDeleteSite = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/sites/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete site")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] })
    },
  })
}

