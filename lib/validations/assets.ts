import { z } from 'zod'

/**
 * Asset form validation schema
 * Validates all asset fields with proper types and constraints
 */
export const assetSchema = z.object({
  // Required fields
  assetTagId: z
    .string()
    .min(1, 'Asset Tag ID is required')
    .max(100, 'Asset Tag ID must be 100 characters or less')
    .regex(
      /^[0-9]{2}-[0-9]{6}[A-Z]-SA$/,
      'Asset Tag ID must match format: YY-XXXXXX[S]-SA (e.g., 25-016011U-SA)'
    ),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(65535, 'Description is too long'),

  // Optional string fields
  purchasedFrom: z
    .string()
    .max(255, 'Purchased From must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  brand: z
    .string()
    .min(1, 'Brand is required')
    .max(100, 'Brand must be 100 characters or less'),
  model: z
    .string()
    .min(1, 'Model is required')
    .max(100, 'Model must be 100 characters or less'),
  serialNo: z
    .string()
    .max(100, 'Serial Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  additionalInformation: z
    .string()
    .max(65535, 'Additional Information is too long')
    .optional()
    .or(z.literal('')),
  xeroAssetNo: z
    .string()
    .max(100, 'Xero Asset Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  owner: z
    .string()
    .max(255, 'Owner must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  pbiNumber: z
    .string()
    .max(100, 'PBI Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  issuedTo: z
    .string()
    .max(255, 'Issued To must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  poNumber: z
    .string()
    .max(100, 'PO Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  paymentVoucherNumber: z
    .string()
    .max(100, 'Payment Voucher Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  assetType: z
    .string()
    .max(100, 'Asset Type must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  remarks: z
    .string()
    .max(65535, 'Remarks is too long')
    .optional()
    .or(z.literal('')),
  qr: z
    .string()
    .max(255, 'QR code must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  oldAssetTag: z
    .string()
    .max(100, 'Old Asset Tag must be 100 characters or less')
    .optional()
    .or(z.literal('')),
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

  // Optional select fields
  status: z
    .string()
    .optional()
    .or(z.literal('')),
  depreciationMethod: z
    .string()
    .max(50, 'Depreciation Method must be 50 characters or less')
    .optional()
    .or(z.literal('')),

  // Optional date fields (as strings from input)
  purchaseDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Purchase Date must be a valid date'
    ),
  deliveryDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Delivery Date must be a valid date'
    ),
  dateAcquired: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Date Acquired must be a valid date'
    ),

  // Optional number fields (as strings from input, validated but kept as strings for form)
  cost: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      'Cost must be a valid positive number'
    ),
  depreciableCost: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      'Depreciable Cost must be a valid positive number'
    ),
  salvageValue: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      'Salvage Value must be a valid positive number'
    ),
  assetLifeMonths: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) > 0 && Number.isInteger(Number(val))),
      'Asset Life (Months) must be a valid positive integer'
    ),

  // Boolean fields
  depreciableAsset: z.boolean(),
  unaccountedInventory: z.boolean(),

  // Required relation fields
  categoryId: z
    .string()
    .min(1, 'Category is required'),
  subCategoryId: z
    .string()
    .min(1, 'Sub Category is required'),
})

export type AssetFormData = z.infer<typeof assetSchema>

/**
 * Edit asset form validation schema
 * Same required fields as assetSchema for consistency
 */
export const editAssetSchema = z.object({
  // Required fields
  assetTagId: z
    .string()
    .min(1, 'Asset Tag ID is required')
    .max(100, 'Asset Tag ID must be 100 characters or less')
    .regex(
      /^[0-9]{2}-[0-9]{6}[A-Z]-SA$/,
      'Asset Tag ID must match format: YY-XXXXXX[S]-SA (e.g., 25-016011U-SA)'
    ),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(65535, 'Description is too long'),

  // Required string fields (same as add form)
  brand: z
    .string()
    .min(1, 'Brand is required')
    .max(100, 'Brand must be 100 characters or less'),
  model: z
    .string()
    .min(1, 'Model is required')
    .max(100, 'Model must be 100 characters or less'),

  // Optional string fields
  purchasedFrom: z
    .string()
    .max(255, 'Purchased From must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  serialNo: z
    .string()
    .max(100, 'Serial Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  additionalInformation: z
    .string()
    .max(65535, 'Additional Information is too long')
    .optional()
    .or(z.literal('')),
  xeroAssetNo: z
    .string()
    .max(100, 'Xero Asset Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  owner: z
    .string()
    .max(255, 'Owner must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  issuedTo: z
    .string()
    .max(255, 'Issued To must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  poNumber: z
    .string()
    .max(100, 'PO Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  assetType: z
    .string()
    .max(100, 'Asset Type must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  remarks: z
    .string()
    .max(65535, 'Remarks is too long')
    .optional()
    .or(z.literal('')),
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

  // Optional date fields (as strings from input)
  purchaseDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Purchase Date must be a valid date'
    ),

  // Optional number fields (as strings from input, validated but kept as strings for form)
  cost: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      'Cost must be a valid positive number'
    ),

  // Required relation fields (same as add form)
  categoryId: z
    .string()
    .min(1, 'Category is required'),
  subCategoryId: z
    .string()
    .min(1, 'Sub Category is required'),
})

export type EditAssetFormData = z.infer<typeof editAssetSchema>

