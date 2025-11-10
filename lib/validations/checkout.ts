import { z } from 'zod'

/**
 * Checkout form validation schema
 * Validates checkout form fields with proper types and constraints
 */
export const checkoutSchema = z.object({
  // Required fields
  employeeId: z
    .string()
    .min(1, 'Employee is required'),
  checkoutDate: z
    .string()
    .min(1, 'Checkout date is required')
    .refine(
      (val) => !isNaN(Date.parse(val)),
      'Checkout date must be a valid date'
    ),

  // Optional fields
  expectedReturnDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Expected return date must be a valid date'
    ),

  // Optional per-asset fields
  department: z
    .string()
    .max(100, 'Department must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  site: z
    .string()
    .max(100, 'Site must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  location: z
    .string()
    .max(255, 'Location must be 255 characters or less')
    .optional()
    .or(z.literal('')),
}).refine(
  (data) => {
    // If expectedReturnDate is provided, it must be after checkoutDate
    if (data.expectedReturnDate && data.checkoutDate) {
      const checkout = new Date(data.checkoutDate)
      const expectedReturn = new Date(data.expectedReturnDate)
      return expectedReturn >= checkout
    }
    return true
  },
  {
    message: 'Expected return date must be on or after checkout date',
    path: ['expectedReturnDate'],
  }
)

export type CheckoutFormData = z.infer<typeof checkoutSchema>

