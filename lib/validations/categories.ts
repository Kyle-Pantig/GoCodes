import { z } from 'zod'

/**
 * Category form validation schema
 * Validates category fields with proper types and constraints
 * Based on Prisma schema: name (VarChar(100), unique), description (Text, optional)
 */
export const categorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name must be 100 characters or less')
    .trim(),
  description: z
    .string()
    .max(65535, 'Description is too long')
    .optional()
    .or(z.literal('')),
})

export type CategoryFormData = z.infer<typeof categorySchema>

/**
 * Subcategory form validation schema
 * Validates subcategory fields with proper types and constraints
 * Based on Prisma schema: name (VarChar(100), unique), description (Text, optional), categoryId (required)
 */
export const subcategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Subcategory name is required')
    .max(100, 'Subcategory name must be 100 characters or less')
    .trim(),
  description: z
    .string()
    .max(65535, 'Description is too long')
    .optional()
    .or(z.literal('')),
  categoryId: z
    .string()
    .min(1, 'Category is required')
    .uuid('Category ID must be a valid UUID'),
})

export type SubcategoryFormData = z.infer<typeof subcategorySchema>

