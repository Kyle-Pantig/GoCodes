import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface Location {
  id: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

interface CreateLocationData {
  name: string
  description?: string | null
}

// Fetch locations
export const useLocations = (enabled: boolean = true, search?: string) => {
  return useQuery({
    queryKey: ["locations", search],
    queryFn: async () => {
      const url = search
        ? `/api/locations?search=${encodeURIComponent(search)}`
        : "/api/locations"
      const response = await fetch(url)
      if (!response.ok) {
        return []
      }
      const data = await response.json()
      return (data.locations || []) as Location[]
    },
    enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Create location mutation
export const useCreateLocation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateLocationData) => {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create location")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] })
    },
  })
}

// Update location mutation
export const useUpdateLocation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...data }: CreateLocationData & { id: string }) => {
      const response = await fetch(`/api/locations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update location")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] })
    },
  })
}

// Delete location mutation
export const useDeleteLocation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/locations/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete location")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] })
    },
  })
}

