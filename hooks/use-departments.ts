import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface Department {
  id: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

interface CreateDepartmentData {
  name: string
  description?: string | null
}

// Fetch departments
export const useDepartments = (enabled: boolean = true, search?: string) => {
  return useQuery<Department[]>({
    queryKey: ["departments", search],
    queryFn: async () => {
      const url = search
        ? `/api/departments?search=${encodeURIComponent(search)}`
        : "/api/departments"
      const response = await fetch(url)
      if (!response.ok) {
        return []
      }
      const data = await response.json()
      return (data.departments || []) as Department[]
    },
    enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Create department mutation
export const useCreateDepartment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateDepartmentData) => {
      const response = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create department")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] })
    },
  })
}

// Update department mutation
export const useUpdateDepartment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...data }: CreateDepartmentData & { id: string }) => {
      const response = await fetch(`/api/departments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update department")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] })
    },
  })
}

// Delete department mutation
export const useDeleteDepartment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/departments/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete department")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] })
    },
  })
}

