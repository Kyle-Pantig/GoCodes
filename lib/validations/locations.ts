import { z } from 'zod'

export const locationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(255, 'Location name must be less than 255 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
})

export type LocationFormData = z.infer<typeof locationSchema>

