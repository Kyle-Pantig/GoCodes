import { z } from 'zod'

/**
 * Company Info form validation schema
 * Validates all company info fields with proper types and constraints
 */
export const companyInfoSchema = z.object({
  companyName: z
    .string()
    .min(1, 'Company name is required')
    .max(255, 'Company name must be 255 characters or less')
    .trim(),
  
  contactEmail: z
    .string()
    .min(1, 'Contact email is required')
    .email('Invalid email address')
    .max(255, 'Email must be 255 characters or less')
    .trim(),
  
  contactPhone: z
    .string()
    .min(1, 'Contact phone is required')
    .max(50, 'Phone number must be 50 characters or less')
    .trim(),
  
  address: z
    .string()
    .min(1, 'Address is required')
    .max(65535, 'Address is too long')
    .trim(),
  
  zipCode: z
    .string()
    .min(1, 'Zip code is required')
    .max(20, 'Zip code must be 20 characters or less')
    .trim(),
  
  country: z
    .string()
    .min(1, 'Country is required')
    .max(100, 'Country name must be 100 characters or less')
    .trim(),
  
  website: z
    .string()
    .min(1, 'Website is required')
    .max(255, 'Website URL must be 255 characters or less')
    .trim()
    .refine(
      (val) => {
        if (!val || val === '') return false
        
        const trimmed = val.trim()
        
        // Must start with http://, https://, or www.
        const hasProtocol = trimmed.startsWith('http://') || trimmed.startsWith('https://')
        const hasWww = trimmed.startsWith('www.')
        
        if (!hasProtocol && !hasWww) {
          return false
        }
        
        // Validate URL format
        try {
          // If it has www. but no protocol, add https:// for validation
          const urlToTest = hasProtocol ? trimmed : `https://${trimmed}`
          new URL(urlToTest)
          return true
        } catch {
          return false
        }
      },
      {
        message: 'Website must start with www. or https:// (e.g., www.gocodes.com or https://gocodes.com)',
      }
    ),
})

export type CompanyInfoFormData = z.infer<typeof companyInfoSchema>

