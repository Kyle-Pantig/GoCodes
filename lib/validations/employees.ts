import { z } from 'zod'

/**
 * Employee form validation schema
 * Validates employee fields with proper types and constraints
 */
export const employeeSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be 255 characters or less')
    .trim(),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email must be 255 characters or less')
    .trim()
    .toLowerCase(),
  department: z
    .string()
    .max(100, 'Department must be 100 characters or less')
    .optional()
    .or(z.literal('')),
})

export type EmployeeFormData = z.infer<typeof employeeSchema>

