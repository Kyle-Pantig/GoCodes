import { z } from 'zod'

/**
 * Audit history form validation schema
 * Validates audit record fields with proper types and constraints
 * Based on Prisma schema: auditType (VarChar(100), required), auditDate (Date, required),
 * notes (Text, optional), auditor (VarChar(255), optional), status (VarChar(50), optional)
 */
export const auditSchema = z.object({
  auditType: z
    .string()
    .min(1, 'Audit type is required')
    .max(100, 'Audit type must be 100 characters or less')
    .trim(),
  auditDate: z
    .string()
    .min(1, 'Audit date is required')
    .refine(
      (val) => !isNaN(Date.parse(val)),
      'Audit date must be a valid date'
    ),
  status: z
    .union([
      z.literal('Completed'),
      z.literal('Pending'),
      z.literal('In Progress'),
      z.literal('Failed'),
    ])
    .optional()
    .or(z.literal('')),
  auditor: z
    .string()
    .max(255, 'Auditor name must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(65535, 'Notes are too long')
    .optional()
    .or(z.literal('')),
})

export type AuditFormData = z.infer<typeof auditSchema>

