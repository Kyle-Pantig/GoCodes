import { z } from 'zod'

export const departmentSchema = z.object({
  name: z
    .string()
    .min(1, 'Department name is required')
    .max(255, 'Department name must be 255 characters or less')
    .trim(),
  description: z
    .string()
    .max(1000, 'Description is too long')
    .optional()
    .or(z.literal('')),
})

export type DepartmentFormData = z.infer<typeof departmentSchema>

