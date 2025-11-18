import { z } from 'zod'

export const siteSchema = z.object({
  name: z
    .string()
    .min(1, 'Site name is required')
    .max(255, 'Site name must be 255 characters or less')
    .trim(),
  description: z
    .string()
    .max(1000, 'Description is too long')
    .optional()
    .or(z.literal('')),
})

export type SiteFormData = z.infer<typeof siteSchema>

