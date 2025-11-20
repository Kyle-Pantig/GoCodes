'use client'

import { useState, useEffect, useRef, useMemo, useCallback, useTransition } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { MediaBrowserDialog } from '@/components/media-browser-dialog'
import { DocumentBrowserDialog } from '@/components/document-browser-dialog'
import { DownloadConfirmationDialog } from '@/components/download-confirmation-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Controller } from 'react-hook-form'
import { Upload, Image as ImageIcon, Eye, X, PlusIcon, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { ImagePreviewDialog } from '@/components/image-preview-dialog'
import { editAssetSchema, type EditAssetFormData } from '@/lib/validations/assets'
import { useCategories, useSubCategories, useCreateCategory, useCreateSubCategory, type Category } from '@/hooks/use-categories'
import { CategoryDialog } from '@/components/category-dialog'
import { SubCategoryDialog } from '@/components/subcategory-dialog'
import { usePermissions } from '@/hooks/use-permissions'
import { SiteSelectField } from '@/components/site-select-field'
import { DepartmentSelectField } from '@/components/department-select-field'

async function updateAsset(id: string, data: Partial<Asset>) {
  const response = await fetch(`/api/assets/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update asset')
  }
  return response.json()
}

interface Asset {
  id: string
  assetTagId: string
  description: string
  brand: string | null
  model: string | null
  serialNo: string | null
  cost: number | null
  assetType: string | null
  location: string | null
  department: string | null
  site: string | null
  owner: string | null
  issuedTo: string | null
  purchasedFrom: string | null
  purchaseDate: string | null
  poNumber: string | null
  xeroAssetNo: string | null
  remarks: string | null
  additionalInformation: string | null
  categoryId: string | null
  subCategoryId: string | null
}

interface EditAssetDialogProps {
  asset: Asset
  open: boolean
  onOpenChange: (open: boolean) => void
  onPreviewImage?: (imageUrl: string) => void
}

export function EditAssetDialog({
  asset,
  open,
  onOpenChange,
}: EditAssetDialogProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const canManageSetup = hasPermission('canManageSetup')
  const [isCheckingAssetTag, setIsCheckingAssetTag] = useState(false)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [selectedExistingImages, setSelectedExistingImages] = useState<Array<{ id: string; imageUrl: string; fileName: string }>>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [imageToDelete, setImageToDelete] = useState<string | null>(null)
  const [isDeleteImageDialogOpen, setIsDeleteImageDialogOpen] = useState(false)
  const [isDeletingImage, setIsDeletingImage] = useState(false)
  const [mediaBrowserOpen, setMediaBrowserOpen] = useState(false)
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewSource, setPreviewSource] = useState<'images' | 'documents'>('images')
  const [, startTransition] = useTransition()
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [subCategoryDialogOpen, setSubCategoryDialogOpen] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  
  // Document states
  const [selectedDocuments, setSelectedDocuments] = useState<File[]>([])
  const [selectedExistingDocuments, setSelectedExistingDocuments] = useState<Array<{ id: string; documentUrl: string; fileName: string }>>([])
  const [uploadingDocuments, setUploadingDocuments] = useState(false)
  const [documentUploadProgress, setDocumentUploadProgress] = useState<number>(0)
  const [documentBrowserOpen, setDocumentBrowserOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null)
  const [isDeleteDocumentDialogOpen, setIsDeleteDocumentDialogOpen] = useState(false)
  const [isDeletingDocument, setIsDeletingDocument] = useState(false)
  const [documentToDownload, setDocumentToDownload] = useState<{ id: string; documentUrl: string; fileName?: string; mimeType?: string | null; documentSize?: number | null } | null>(null)
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false)
  const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState(false)
  const documentInputRef = useRef<HTMLInputElement>(null)

  // Categories and subcategories - only fetch when dialog is open to avoid unnecessary requests
  const { data: categories = [] } = useCategories(open)
  const createCategoryMutation = useCreateCategory()
  const createSubCategoryMutation = useCreateSubCategory()

  const form = useForm<EditAssetFormData>({
    resolver: zodResolver(editAssetSchema),
    defaultValues: {
      assetTagId: asset.assetTagId,
      description: asset.description,
      brand: asset.brand || '',
      model: asset.model || '',
      serialNo: asset.serialNo || '',
      cost: asset.cost?.toString() || '',
      assetType: asset.assetType || '',
      location: asset.location || '',
      department: asset.department || '',
      site: asset.site || '',
      owner: asset.owner || '',
      issuedTo: asset.issuedTo || '',
      purchasedFrom: asset.purchasedFrom || '',
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
      poNumber: asset.poNumber || '',
      xeroAssetNo: asset.xeroAssetNo || '',
      remarks: asset.remarks || '',
      additionalInformation: asset.additionalInformation || '',
      categoryId: asset.categoryId || '',
      subCategoryId: asset.subCategoryId || '',
    },
  })

  // Watch categoryId to sync with selectedCategory state
  const categoryId = form.watch('categoryId')
  const selectedCategory = categoryId || ''
  // Only fetch subcategories when dialog is open to avoid unnecessary requests
  const { data: subCategories = [] } = useSubCategories(open ? (selectedCategory || null) : null)

  // Reset subcategory when category changes
  const handleCategoryChange = (value: string) => {
    form.setValue('categoryId', value)
    form.setValue('subCategoryId', '')
  }

  const handleCreateCategory = async (data: { name: string; description?: string }) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage categories')
      return
    }

    try {
      await createCategoryMutation.mutateAsync(data)
      setCategoryDialogOpen(false)
      toast.success('Category created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create category')
    }
  }

  const handleCreateSubCategory = async (data: { name: string; description?: string; categoryId: string }) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage categories')
      return
    }

    if (!selectedCategory) {
      toast.error('Please select a category first')
      return
    }

    try {
      await createSubCategoryMutation.mutateAsync({
        ...data,
        categoryId: selectedCategory,
      })
      setSubCategoryDialogOpen(false)
      toast.success('Sub category created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create subcategory')
    }
  }

  // Create object URLs for selected images
  const selectedImageUrls = useMemo(() => {
    return selectedImages.map(file => URL.createObjectURL(file))
  }, [selectedImages])

  // Reset form when dialog opens/closes or asset changes
  useEffect(() => {
    if (open) {
      form.reset({
        assetTagId: asset.assetTagId,
        description: asset.description,
        brand: asset.brand || '',
        model: asset.model || '',
        serialNo: asset.serialNo || '',
        cost: asset.cost?.toString() || '',
        assetType: asset.assetType || '',
        location: asset.location || '',
        department: asset.department || '',
        site: asset.site || '',
        owner: asset.owner || '',
        issuedTo: asset.issuedTo || '',
        purchasedFrom: asset.purchasedFrom || '',
        purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
        poNumber: asset.poNumber || '',
        xeroAssetNo: asset.xeroAssetNo || '',
        remarks: asset.remarks || '',
        additionalInformation: asset.additionalInformation || '',
        categoryId: asset.categoryId || '',
        subCategoryId: asset.subCategoryId || '',
      })
    } else {
      setSelectedImages([])
      setSelectedExistingImages([])
      setSelectedDocuments([])
      setSelectedExistingDocuments([])
    }
  }, [open, asset, form])

  // Create object URLs for selected documents
  const selectedDocumentUrls = useMemo(() => {
    return selectedDocuments.map(file => URL.createObjectURL(file))
  }, [selectedDocuments])

  // Cleanup object URLs when component unmounts or selectedImages change
  useEffect(() => {
    return () => {
      selectedImageUrls.forEach(url => URL.revokeObjectURL(url))
      selectedDocumentUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [selectedImageUrls, selectedDocumentUrls])

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const formIsDirty = form.formState.isDirty
    const hasSelectedImages = selectedImages.length > 0 || selectedExistingImages.length > 0
    const hasSelectedDocuments = selectedDocuments.length > 0 || selectedExistingDocuments.length > 0
    return formIsDirty || hasSelectedImages || hasSelectedDocuments
  }, [form.formState.isDirty, selectedImages.length, selectedExistingImages.length, selectedDocuments.length, selectedExistingDocuments.length])

  // Handle dialog close with unsaved changes check
  const handleDialogClose = useCallback((shouldClose: boolean) => {
    if (!shouldClose) {
      // Dialog is being closed
      if (hasUnsavedChanges) {
        // Show confirmation dialog
        setIsUnsavedChangesDialogOpen(true)
      } else {
        // No unsaved changes, close immediately
        onOpenChange(false)
      }
    } else {
      // Dialog is being opened
      setIsUnsavedChangesDialogOpen(false)
      onOpenChange(true)
    }
  }, [hasUnsavedChanges, onOpenChange])

  // Handle unsaved changes confirmation
  const handleDiscardChanges = useCallback(() => {
    setIsUnsavedChangesDialogOpen(false)
    // Reset form and clear selections
    form.reset()
    setSelectedImages([])
    setSelectedExistingImages([])
    setSelectedDocuments([])
    setSelectedExistingDocuments([])
    // Close dialog
    onOpenChange(false)
  }, [form, onOpenChange])

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Asset> }) => updateAsset(id, data),
    onSuccess: (response) => {
      const updatedAsset = response?.asset || response
      const updatedAssetTagId = updatedAsset?.assetTagId || asset?.assetTagId
      const oldAssetTagId = asset?.assetTagId
      
      // Invalidate all assets list queries (both 'assets' and 'assets-list' patterns)
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['assets-list'] })
      
      // Invalidate the specific asset query
      queryClient.invalidateQueries({ queryKey: ['asset', asset.id] })
      
      // If assetTagId changed, invalidate queries for the old assetTagId
      if (oldAssetTagId && updatedAssetTagId && oldAssetTagId !== updatedAssetTagId) {
        queryClient.invalidateQueries({ queryKey: ['asset-thumbnail', oldAssetTagId] })
        queryClient.invalidateQueries({ queryKey: ['asset-images', oldAssetTagId] })
        queryClient.invalidateQueries({ queryKey: ['asset-documents', oldAssetTagId] })
      }
      
      // Invalidate queries for the updated assetTagId
      if (updatedAssetTagId) {
        queryClient.invalidateQueries({ queryKey: ['asset-thumbnail', updatedAssetTagId] })
        queryClient.invalidateQueries({ queryKey: ['asset-images', updatedAssetTagId] })
        queryClient.invalidateQueries({ queryKey: ['asset-documents', updatedAssetTagId] })
        queryClient.invalidateQueries({ queryKey: ['assets', 'images', updatedAssetTagId] })
        queryClient.invalidateQueries({ queryKey: ['assets', 'documents', updatedAssetTagId] })
      }
      
      // Invalidate asset history queries
      queryClient.invalidateQueries({ queryKey: ['asset-history', asset.id] })
    },
    onError: () => {
      toast.error('Failed to update asset')
    },
  })

  // Fetch images using React Query for caching
  const { data: existingImagesData, isLoading: loadingExistingImages, refetch: refetchExistingImages } = useQuery({
    queryKey: ['assets', 'images', asset.assetTagId],
    queryFn: async () => {
      if (!asset.assetTagId) return { images: [] }
      const response = await fetch(`/api/assets/images/${asset.assetTagId}`)
      if (response.ok) {
        const data = await response.json()
        return { images: data.images || [] }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch images:', errorData)
        return { images: [] }
      }
    },
    enabled: open && !!asset.assetTagId,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  })

  const existingImages = existingImagesData?.images || []

  // Fetch documents using React Query for caching
  const { data: existingDocumentsData, isLoading: loadingExistingDocuments, refetch: refetchExistingDocuments } = useQuery({
    queryKey: ['assets', 'documents', asset.assetTagId],
    queryFn: async () => {
      if (!asset.assetTagId) return { documents: [] }
      const response = await fetch(`/api/assets/documents/${asset.assetTagId}`)
      if (response.ok) {
        const data = await response.json()
        return { documents: data.documents || [] }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch documents:', errorData)
        return { documents: [] }
      }
    },
    enabled: open && !!asset.assetTagId,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  })

  const existingDocuments = existingDocumentsData?.documents || []

  // Check if asset tag ID exists (excluding current asset)
  const checkAssetTagExists = useCallback(async (assetTagId: string): Promise<boolean> => {
    if (!assetTagId || assetTagId.trim() === '' || assetTagId === asset.assetTagId) {
      return false
    }

    try {
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetTagId.trim())}&pageSize=1`)
      if (!response.ok) return false
      const data = await response.json()
      return data.assets?.some((a: { assetTagId: string; id: string }) => 
        a.assetTagId === assetTagId.trim() && a.id !== asset.id
      ) || false
    } catch {
      return false
    }
  }, [asset.assetTagId, asset.id])

  // Watch assetTagId for uniqueness check
  const assetTagId = form.watch('assetTagId')
  const assetTagValidationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return

    if (assetTagValidationTimeoutRef.current) {
      clearTimeout(assetTagValidationTimeoutRef.current)
    }

    if (assetTagId === asset.assetTagId) {
      form.clearErrors('assetTagId')
      return
    }

    if (!assetTagId || assetTagId.trim() === '') {
      return
    }

    setIsCheckingAssetTag(true)
    assetTagValidationTimeoutRef.current = setTimeout(async () => {
      const exists = await checkAssetTagExists(assetTagId)
      if (exists) {
        form.setError('assetTagId', {
          type: 'manual',
          message: 'This Asset Tag ID already exists',
        })
      } else {
        form.clearErrors('assetTagId')
      }
      setIsCheckingAssetTag(false)
    }, 500)

    return () => {
      if (assetTagValidationTimeoutRef.current) {
        clearTimeout(assetTagValidationTimeoutRef.current)
      }
    }
  }, [assetTagId, open, asset.assetTagId, checkAssetTagExists, form])

  const handleDeleteImageClick = (imageId: string) => {
    setImageToDelete(imageId)
    setIsDeleteImageDialogOpen(true)
  }

  const deleteExistingImage = async () => {
    if (!imageToDelete) return

    setIsDeletingImage(true)
    try {
      const response = await fetch(`/api/assets/images/delete/${imageToDelete}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['assets', 'images', asset.assetTagId] })
        queryClient.invalidateQueries({ queryKey: ['assets'] })
        queryClient.invalidateQueries({ queryKey: ['assets-list'] })
        queryClient.invalidateQueries({ queryKey: ['assets', 'media'] })
        toast.success('Image deleted successfully')
        setIsDeleteImageDialogOpen(false)
        setImageToDelete(null)
      } else {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 404) {
          queryClient.invalidateQueries({ queryKey: ['assets', 'images', asset.assetTagId] })
          queryClient.invalidateQueries({ queryKey: ['assets'] })
          queryClient.invalidateQueries({ queryKey: ['assets-list'] })
          queryClient.invalidateQueries({ queryKey: ['assets', 'media'] })
          toast.success('Image removed')
        } else {
          toast.error(errorData.error || 'Failed to delete image')
        }
        setIsDeleteImageDialogOpen(false)
        setImageToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting image:', error)
      toast.error('Failed to delete image')
      setIsDeleteImageDialogOpen(false)
      setImageToDelete(null)
    } finally {
      setIsDeletingImage(false)
    }
  }

  const uploadImage = async (file: File, assetTagId: string, onProgress?: (progress: number) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('assetTagId', assetTagId)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100
          onProgress(percentComplete)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          try {
            const error = JSON.parse(xhr.responseText)
            reject(new Error(error.error || 'Failed to upload image'))
          } catch {
            reject(new Error('Failed to upload image'))
          }
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Failed to upload image'))
      })

      xhr.open('POST', '/api/assets/upload-image')
      xhr.send(formData)
    })
  }

  const linkExistingImage = async (imageUrl: string, assetTagId: string): Promise<void> => {
    const response = await fetch('/api/assets/upload-image', {
      method: 'POST',
      body: JSON.stringify({
        imageUrl,
        assetTagId,
        linkExisting: true,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to link image')
    }
  }

  const uploadDocument = async (file: File, assetTagId: string, onProgress?: (progress: number) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('assetTagId', assetTagId)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100
          onProgress(percentComplete)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          try {
            const error = JSON.parse(xhr.responseText)
            reject(new Error(error.error || 'Failed to upload document'))
          } catch {
            reject(new Error('Failed to upload document'))
          }
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Network error while uploading document'))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload aborted'))
      })

      xhr.open('POST', '/api/assets/upload-document')
      xhr.send(formData)
    })
  }

  const linkExistingDocument = async (documentUrl: string, assetTagId: string): Promise<void> => {
    const response = await fetch('/api/assets/upload-document', {
      method: 'POST',
      body: JSON.stringify({
        documentUrl,
        assetTagId,
        linkExisting: true,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to link document')
    }
  }

  const handleDeleteDocumentClick = (documentId: string) => {
    setDocumentToDelete(documentId)
    setIsDeleteDocumentDialogOpen(true)
  }

  const deleteExistingDocument = async () => {
    if (!documentToDelete) return

    setIsDeletingDocument(true)
    try {
      const response = await fetch(`/api/assets/documents/delete/${documentToDelete}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['assets', 'documents', asset.assetTagId] })
        queryClient.invalidateQueries({ queryKey: ['assets'] })
        queryClient.invalidateQueries({ queryKey: ['assets-list'] })
        queryClient.invalidateQueries({ queryKey: ['assets', 'documents'] })
        toast.success('Document deleted successfully')
        setIsDeleteDocumentDialogOpen(false)
        setDocumentToDelete(null)
      } else {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 404) {
          queryClient.invalidateQueries({ queryKey: ['assets', 'documents', asset.assetTagId] })
          queryClient.invalidateQueries({ queryKey: ['assets'] })
          queryClient.invalidateQueries({ queryKey: ['assets-list'] })
          queryClient.invalidateQueries({ queryKey: ['assets', 'documents'] })
          toast.success('Document removed')
        } else {
          toast.error(errorData.error || 'Failed to delete document')
        }
        setIsDeleteDocumentDialogOpen(false)
        setDocumentToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Failed to delete document')
      setIsDeleteDocumentDialogOpen(false)
      setDocumentToDelete(null)
    } finally {
      setIsDeletingDocument(false)
    }
  }

  const onSubmit = async (data: EditAssetFormData) => {
    // Final uniqueness check if asset tag changed
    if (data.assetTagId !== asset.assetTagId) {
      const exists = await checkAssetTagExists(data.assetTagId)
      if (exists) {
        form.setError('assetTagId', {
          type: 'manual',
          message: 'This Asset Tag ID already exists',
        })
        toast.error('This Asset Tag ID already exists')
        return
      }
    }

    const updateData = {
      assetTagId: data.assetTagId.trim(),
      description: data.description,
      brand: data.brand || null,
      model: data.model || null,
      serialNo: data.serialNo || null,
      cost: data.cost ? parseFloat(data.cost) : null,
      assetType: data.assetType || null,
      location: data.location || null,
      department: data.department || null,
      site: data.site || null,
      owner: data.owner || null,
      issuedTo: data.issuedTo || null,
      purchasedFrom: data.purchasedFrom || null,
      purchaseDate: data.purchaseDate || null,
      poNumber: data.poNumber || null,
      xeroAssetNo: data.xeroAssetNo || null,
      remarks: data.remarks || null,
      additionalInformation: data.additionalInformation || null,
      categoryId: data.categoryId || null,
      subCategoryId: data.subCategoryId || null,
    }

    try {
      await updateMutation.mutateAsync({ id: asset.id, data: updateData })

      const updatedAssetTagId = data.assetTagId.trim()
      const totalImages = selectedImages.length + selectedExistingImages.length
      const totalDocuments = selectedDocuments.length + selectedExistingDocuments.length
      
      if ((totalImages > 0 || totalDocuments > 0) && updatedAssetTagId) {
        if (totalImages > 0) {
          setUploadingImages(true)
          setUploadProgress(0)
          try {
            if (selectedImages.length > 0) {
              const totalNewImages = selectedImages.length
              let uploadedCount = 0

              for (let i = 0; i < selectedImages.length; i++) {
                await uploadImage(selectedImages[i], updatedAssetTagId, (progress) => {
                  const overallProgress = ((uploadedCount + progress / 100) / totalNewImages) * 100
                  setUploadProgress(Math.min(overallProgress, 100))
                })
                uploadedCount++
                setUploadProgress((uploadedCount / totalNewImages) * 100)
              }
            }

            if (selectedExistingImages.length > 0) {
              await Promise.all(
                selectedExistingImages.map(img => linkExistingImage(img.imageUrl, updatedAssetTagId))
              )
            }
          } catch (error) {
            console.error('Error uploading images:', error)
            toast.error('Asset updated but some images failed to upload')
            setUploadProgress(0)
          } finally {
            setUploadingImages(false)
          }
        }

        if (totalDocuments > 0) {
          setUploadingDocuments(true)
          setDocumentUploadProgress(0)
          try {
            if (selectedDocuments.length > 0) {
              const totalNewDocuments = selectedDocuments.length
              let uploadedCount = 0

              for (let i = 0; i < selectedDocuments.length; i++) {
                await uploadDocument(selectedDocuments[i], updatedAssetTagId, (progress) => {
                  const overallProgress = ((uploadedCount + progress / 100) / totalNewDocuments) * 100
                  setDocumentUploadProgress(Math.min(overallProgress, 100))
                })
                uploadedCount++
                setDocumentUploadProgress((uploadedCount / totalNewDocuments) * 100)
              }
            }

            if (selectedExistingDocuments.length > 0) {
              await Promise.all(
                selectedExistingDocuments.map(doc => linkExistingDocument(doc.documentUrl, updatedAssetTagId))
              )
            }
          } catch (error) {
            console.error('Error uploading documents:', error)
            toast.error('Asset updated but some documents failed to upload')
            setDocumentUploadProgress(0)
          } finally {
            setUploadingDocuments(false)
          }
        }

        const mediaCount = totalImages + totalDocuments
        toast.success(`Asset updated successfully with ${mediaCount} file(s)`)
        // Close dialog immediately for responsive UX
        onOpenChange(false)
        // Cleanup state in transition (non-urgent)
        startTransition(() => {
          setSelectedImages([])
          setSelectedExistingImages([])
          setSelectedDocuments([])
          setSelectedExistingDocuments([])
          setUploadProgress(0)
          setDocumentUploadProgress(0)
          form.reset() // Reset form to clear dirty state
        })
        // Invalidate queries in background (non-blocking)
        queryClient.invalidateQueries({ queryKey: ['assets', 'images', updatedAssetTagId] })
        queryClient.invalidateQueries({ queryKey: ['assets', 'documents', updatedAssetTagId] })
        if (updatedAssetTagId !== asset.assetTagId) {
          queryClient.invalidateQueries({ queryKey: ['assets', 'images', asset.assetTagId] })
          queryClient.invalidateQueries({ queryKey: ['assets', 'documents', asset.assetTagId] })
        }
        queryClient.invalidateQueries({ queryKey: ['assets', 'media'] })
        queryClient.invalidateQueries({ queryKey: ['assets', 'documents'] })
        refetchExistingImages()
        refetchExistingDocuments()
        queryClient.refetchQueries({ queryKey: ['assets'] })
        queryClient.refetchQueries({ queryKey: ['assets-list'] })
      } else {
        toast.success('Asset updated successfully')
        // Close dialog immediately for better UX
        onOpenChange(false)
        // Invalidate queries in background (non-blocking)
        queryClient.invalidateQueries({ queryKey: ['assets', 'images', asset.assetTagId] })
        queryClient.invalidateQueries({ queryKey: ['assets', 'documents', asset.assetTagId] })
        refetchExistingImages()
        refetchExistingDocuments()
        queryClient.refetchQueries({ queryKey: ['assets'] })
        queryClient.refetchQueries({ queryKey: ['assets-list'] })
      }
    } catch {
      // Error already handled by mutation
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>
              Update the details of this asset. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea>
              <div className="max-h-[70vh]">
                <div className="grid gap-4 py-4">
                  <Field>
                    <FieldLabel htmlFor="assetTagId">
                      Asset Tag ID <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id="assetTagId"
                        {...form.register("assetTagId")}
                        aria-invalid={form.formState.errors.assetTagId ? "true" : "false"}
                        className={form.formState.errors.assetTagId ? 'border-destructive' : ''}
                      />
                      {isCheckingAssetTag && (
                        <p className="text-xs text-muted-foreground">Checking availability...</p>
                      )}
                      {form.formState.errors.assetTagId && (
                        <FieldError>{form.formState.errors.assetTagId.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="description">
                      Description <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <Textarea
                        id="description"
                        {...form.register("description")}
                        rows={3}
                        aria-invalid={form.formState.errors.description ? "true" : "false"}
                      />
                      {form.formState.errors.description && (
                        <FieldError>{form.formState.errors.description.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <Field>
                    <div className="flex items-center justify-between w-full">
                      <FieldLabel htmlFor="category">
                        Category <span className="text-destructive">*</span>
                      </FieldLabel>
                      {canManageSetup && (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-6 w-6"
                            onClick={() => setCategoryDialogOpen(true)}
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </Button>
                          <CategoryDialog
                            open={categoryDialogOpen}
                            onOpenChange={setCategoryDialogOpen}
                            onSubmit={handleCreateCategory}
                            mode="create"
                            isLoading={createCategoryMutation.isPending}
                          />
                        </>
                      )}
                    </div>
                    <FieldContent>
                      <Controller
                        name="categoryId"
                        control={form.control}
                        render={({ field }) => (
                          <Select
                            value={field.value || ""}
                            onValueChange={(value) => {
                              field.onChange(value)
                              handleCategoryChange(value)
                            }}
                          >
                            <SelectTrigger className="w-full" aria-invalid={form.formState.errors.categoryId ? "true" : "false"}>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories?.map((category: Category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {form.formState.errors.categoryId && (
                        <FieldError>{form.formState.errors.categoryId.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <Field>
                    <div className="flex items-center justify-between w-full">
                      <FieldLabel htmlFor="subCategory">
                        Sub Category <span className="text-destructive">*</span>
                      </FieldLabel>
                      {canManageSetup && (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            disabled={!selectedCategory}
                            className="h-6 w-6"
                            onClick={() => setSubCategoryDialogOpen(true)}
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </Button>
                          <SubCategoryDialog
                            open={subCategoryDialogOpen}
                            onOpenChange={setSubCategoryDialogOpen}
                            onSubmit={handleCreateSubCategory}
                            mode="create"
                            categories={categories}
                            selectedCategoryName={categories.find(c => c.id === selectedCategory)?.name}
                            isLoading={createSubCategoryMutation.isPending}
                          />
                        </>
                      )}
                  </div>
                    <FieldContent>
                      <Controller
                        name="subCategoryId"
                        control={form.control}
                        render={({ field }) => (
                          <Select
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            disabled={!selectedCategory}
                          >
                            <SelectTrigger className="w-full" disabled={!selectedCategory} aria-invalid={form.formState.errors.subCategoryId ? "true" : "false"}>
                              <SelectValue 
                                placeholder={
                                  selectedCategory 
                                    ? "Select a sub category" 
                                    : "Select a category first"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {subCategories?.map((subCat) => (
                                <SelectItem key={subCat.id} value={subCat.id}>
                                  {subCat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {form.formState.errors.subCategoryId && (
                        <FieldError>{form.formState.errors.subCategoryId.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="brand">
                        Brand <span className="text-destructive">*</span>
                      </FieldLabel>
                      <FieldContent>
                        <Input
                          id="brand"
                          {...form.register("brand")}
                          aria-invalid={form.formState.errors.brand ? "true" : "false"}
                        />
                        {form.formState.errors.brand && (
                          <FieldError>{form.formState.errors.brand.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="model">
                        Model <span className="text-destructive">*</span>
                      </FieldLabel>
                      <FieldContent>
                        <Input
                          id="model"
                          {...form.register("model")}
                          aria-invalid={form.formState.errors.model ? "true" : "false"}
                        />
                        {form.formState.errors.model && (
                          <FieldError>{form.formState.errors.model.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="serialNo">Serial No</FieldLabel>
                      <FieldContent>
                        <Input
                          id="serialNo"
                          {...form.register("serialNo")}
                          aria-invalid={form.formState.errors.serialNo ? "true" : "false"}
                        />
                        {form.formState.errors.serialNo && (
                          <FieldError>{form.formState.errors.serialNo.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="cost">Cost</FieldLabel>
                      <FieldContent>
                        <Input
                          id="cost"
                          type="number"
                          step="0.01"
                          {...form.register("cost")}
                          aria-invalid={form.formState.errors.cost ? "true" : "false"}
                        />
                        {form.formState.errors.cost && (
                          <FieldError>{form.formState.errors.cost.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="assetType">Asset Type</FieldLabel>
                      <FieldContent>
                        <Input
                          id="assetType"
                          {...form.register("assetType")}
                          aria-invalid={form.formState.errors.assetType ? "true" : "false"}
                        />
                        {form.formState.errors.assetType && (
                          <FieldError>{form.formState.errors.assetType.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="location">Location</FieldLabel>
                      <FieldContent>
                        <Input
                          id="location"
                          {...form.register("location")}
                          aria-invalid={form.formState.errors.location ? "true" : "false"}
                        />
                        {form.formState.errors.location && (
                          <FieldError>{form.formState.errors.location.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <DepartmentSelectField
                      name="department"
                      control={form.control}
                      error={form.formState.errors.department}
                      label="Department"
                      placeholder="Select or search department"
                      canCreate={canManageSetup}
                    />
                    <SiteSelectField
                      name="site"
                      control={form.control}
                      error={form.formState.errors.site}
                      label="Site"
                      placeholder="Select or search site"
                      canCreate={canManageSetup}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="owner">Owner</FieldLabel>
                      <FieldContent>
                        <Input
                          id="owner"
                          {...form.register("owner")}
                          aria-invalid={form.formState.errors.owner ? "true" : "false"}
                        />
                        {form.formState.errors.owner && (
                          <FieldError>{form.formState.errors.owner.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="issuedTo">Issued To</FieldLabel>
                      <FieldContent>
                        <Input
                          id="issuedTo"
                          {...form.register("issuedTo")}
                          aria-invalid={form.formState.errors.issuedTo ? "true" : "false"}
                        />
                        {form.formState.errors.issuedTo && (
                          <FieldError>{form.formState.errors.issuedTo.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="purchasedFrom">Purchased From</FieldLabel>
                      <FieldContent>
                        <Input
                          id="purchasedFrom"
                          {...form.register("purchasedFrom")}
                          aria-invalid={form.formState.errors.purchasedFrom ? "true" : "false"}
                        />
                        {form.formState.errors.purchasedFrom && (
                          <FieldError>{form.formState.errors.purchasedFrom.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="purchaseDate">Purchase Date</FieldLabel>
                      <FieldContent>
                        <Input
                          id="purchaseDate"
                          type="date"
                          {...form.register("purchaseDate")}
                          aria-invalid={form.formState.errors.purchaseDate ? "true" : "false"}
                        />
                        {form.formState.errors.purchaseDate && (
                          <FieldError>{form.formState.errors.purchaseDate.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="poNumber">PO Number</FieldLabel>
                      <FieldContent>
                        <Input
                          id="poNumber"
                          {...form.register("poNumber")}
                          aria-invalid={form.formState.errors.poNumber ? "true" : "false"}
                        />
                        {form.formState.errors.poNumber && (
                          <FieldError>{form.formState.errors.poNumber.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="xeroAssetNo">Xero Asset No</FieldLabel>
                      <FieldContent>
                        <Input
                          id="xeroAssetNo"
                          {...form.register("xeroAssetNo")}
                          aria-invalid={form.formState.errors.xeroAssetNo ? "true" : "false"}
                        />
                        {form.formState.errors.xeroAssetNo && (
                          <FieldError>{form.formState.errors.xeroAssetNo.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
                    <FieldContent>
                      <Textarea
                        id="remarks"
                        {...form.register("remarks")}
                        rows={3}
                        aria-invalid={form.formState.errors.remarks ? "true" : "false"}
                      />
                      {form.formState.errors.remarks && (
                        <FieldError>{form.formState.errors.remarks.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="additionalInformation">Additional Information</FieldLabel>
                    <FieldContent>
                      <Textarea
                        id="additionalInformation"
                        {...form.register("additionalInformation")}
                        rows={3}
                        aria-invalid={form.formState.errors.additionalInformation ? "true" : "false"}
                      />
                      {form.formState.errors.additionalInformation && (
                        <FieldError>{form.formState.errors.additionalInformation.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <div className="grid gap-2">
                    <Label htmlFor="images">Asset Images</Label>

                    {loadingExistingImages ? (
                      <div className="flex items-center justify-center py-4">
                        <Spinner className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="space-y-2 mb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {existingImages.map((image: { id: string; imageUrl: string; assetTagId: string; fileName?: string; createdAt?: string }, index: number) => (
                            <div
                              key={image.id}
                              className="relative group border rounded-lg overflow-visible cursor-pointer"
                              onClick={() => {
                                // Set the index of the clicked image and open preview
                                setPreviewSource('images')
                                setPreviewImageIndex(index)
                                setIsPreviewOpen(true)
                              }}
                            >
                              <div className="aspect-square bg-muted relative overflow-hidden rounded-lg">
                                <Image
                                  src={image.imageUrl}
                                  alt={`Asset ${asset.assetTagId} image`}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-10">
                                  <div className="bg-white/50 rounded-full p-3 shadow-lg">
                                    <Eye className="h-6 w-6 text-black" />
                                  </div>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="default"
                                size="icon"
                                className="absolute top-0 right-0 h-5 w-5 bg-red-500 hover:bg-red-400 rounded-tr-lg rounded-br-none rounded-tl-none z-20 shadow-lg"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteImageClick(image.id)
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          {selectedExistingImages.map((img) => (
                            <div key={img.id} className="relative group border rounded-lg overflow-hidden">
                              <div className="aspect-square bg-muted relative overflow-hidden rounded-lg">
                                <Image
                                  src={img.imageUrl}
                                  alt={img.fileName}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </div>
                              {!uploadingImages && (
                                <Button
                                  type="button"
                                  variant="default"
                                  size="icon"
                                  className="absolute top-0 right-0 h-5 w-5 bg-red-500 hover:bg-red-400 rounded-tr-lg rounded-br-none rounded-tl-none z-20 shadow-lg"
                                  onClick={() => setSelectedExistingImages(prev => prev.filter(i => i.id !== img.id))}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                          {selectedImages.map((file, index) => (
                            <div key={`selected-${index}`} className="relative group border rounded-lg overflow-hidden">
                              <div className="aspect-square bg-muted relative overflow-hidden rounded-lg">
                                <Image
                                  src={selectedImageUrls[index]}
                                  alt={`Selected image ${index + 1}`}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                                {uploadingImages && (
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                                    <div className="text-center">
                                      <div className="text-white text-sm font-medium mb-1">
                                        {Math.round(uploadProgress)}%
                                      </div>
                                      <div className="w-16 h-1 bg-white/30 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-white transition-all duration-300"
                                          style={{ width: `${uploadProgress}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {!uploadingImages && (
                                <Button
                                  type="button"
                                  variant="default"
                                  size="icon"
                                  className="absolute top-0 right-0 h-5 w-5 bg-red-500 hover:bg-red-400 rounded-tr-lg rounded-br-none rounded-tl-none z-20 shadow-lg"
                                  onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <div className="aspect-square border-2 border-dashed border-muted rounded-lg flex items-center justify-center">
                            <input
                              ref={imageInputRef}
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                              multiple
                              className="hidden"
                              onClick={(e) => {
                                // Prevent any accidental form submission
                                e.stopPropagation()
                              }}
                              onChange={(e) => {
                                e.stopPropagation()
                                const files = Array.from(e.target.files || [])

                                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
                                const maxSize = 5 * 1024 * 1024 // 5MB

                                const validFiles = files.filter(file => {
                                  if (!allowedTypes.includes(file.type)) {
                                    toast.error(`${file.name} is not a valid image type. Only JPEG, PNG, GIF, and WebP are allowed.`)
                                    return false
                                  }
                                  if (file.size > maxSize) {
                                    toast.error(`${file.name} is too large. Maximum size is 5MB.`)
                                    return false
                                  }
                                  return true
                                })

                                // Only add to state - upload will happen on form submit
                                setSelectedImages(prev => [...prev, ...validFiles])

                                if (imageInputRef.current) {
                                  imageInputRef.current.value = ''
                                }
                              }}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-full w-full"
                                >
                                  <Upload className="h-6 w-6" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    imageInputRef.current?.click()
                                  }}
                                >
                                  <Upload className="mr-2 h-4 w-4" />
                                  Upload Images
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setMediaBrowserOpen(true)
                                  }}
                                >
                                  <ImageIcon className="mr-2 h-4 w-4" />
                                  Select from Media
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="documents">Asset Documents</Label>

                    {loadingExistingDocuments ? (
                      <div className="flex items-center justify-center py-4">
                        <Spinner className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="space-y-2 mb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {existingDocuments.map((doc: { id: string; documentUrl: string; assetTagId: string; fileName?: string; mimeType?: string | null; documentSize?: number | null; createdAt?: string }) => {
                            const isImage = doc.mimeType?.startsWith('image/') || 
                              /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
                            return (
                              <div
                                key={doc.id}
                                className="relative group border rounded-lg overflow-visible cursor-pointer"
                                onClick={() => {
                                  if (isImage) {
                                    // Find index of this document among image documents
                                    // The preview dialog shows: [existingImages, ...imageDocuments]
                                    // So we need to offset by existingImages.length
                                    const imageDocuments = existingDocuments.filter((document: { mimeType?: string | null; fileName?: string }) => {
                                      const docIsImage = document.mimeType?.startsWith('image/') || 
                                        /\.(jpg|jpeg|png|gif|webp)$/i.test(document.fileName || '')
                                      return docIsImage
                                    })
                                    const imageIndex = imageDocuments.findIndex((document: { id: string }) => document.id === doc.id)
                                    if (imageIndex >= 0) {
                                      // Show only document images when clicking from documents section
                                      setPreviewSource('documents')
                                      setPreviewImageIndex(imageIndex)
                                      setIsPreviewOpen(true)
                                    }
                                  } else {
                                    // For non-image documents, open in new tab or show download confirmation
                                    const isPdf = doc.mimeType === 'application/pdf' || 
                                      /\.pdf$/i.test(doc.fileName || '')
                                    const isDownloadable = doc.mimeType?.includes('excel') || 
                                      doc.mimeType?.includes('spreadsheet') ||
                                      doc.mimeType?.includes('word') ||
                                      doc.mimeType?.includes('document') ||
                                      /\.(xls|xlsx|doc|docx)$/i.test(doc.fileName || '')
                                    
                                    if (isPdf) {
                                      // PDF: open in new tab
                                      window.open(doc.documentUrl, '_blank')
                                    } else if (isDownloadable) {
                                      // Excel, Word, etc.: show download confirmation dialog
                                      setDocumentToDownload({
                                        id: doc.id,
                                        documentUrl: doc.documentUrl,
                                        fileName: doc.fileName,
                                        mimeType: doc.mimeType,
                                        documentSize: doc.documentSize,
                                      })
                                      setIsDownloadDialogOpen(true)
                                    } else {
                                      // Other files: try to open in new tab
                                      window.open(doc.documentUrl, '_blank')
                                    }
                                  }
                                }}
                              >
                                <div className="aspect-square bg-muted relative overflow-hidden rounded-lg flex items-center justify-center">
                                  {isImage ? (
                                    <Image
                                      src={doc.documentUrl}
                                      alt={doc.fileName || 'Document'}
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    <FileText className="h-12 w-12 text-muted-foreground" />
                                  )}
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-10">
                                    <div className="bg-white/50 rounded-full p-3 shadow-lg">
                                      <Eye className="h-6 w-6 text-black" />
                                    </div>
                                  </div>
                                </div>
                                {doc.fileName && !isImage && (
                                  <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] px-1 py-0.5 truncate rounded-b-lg">
                                    {doc.fileName}
                                  </div>
                                )}
                                <Button
                                  type="button"
                                  variant="default"
                                  size="icon"
                                  className="absolute top-0 right-0 h-5 w-5 bg-red-500 hover:bg-red-400 rounded-tr-lg rounded-br-none rounded-tl-none z-20 shadow-lg"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteDocumentClick(doc.id)
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )
                          })}
                          {selectedExistingDocuments.map((doc) => {
                            const isImage = doc.documentUrl && (
                              doc.documentUrl.includes('.jpg') || 
                              doc.documentUrl.includes('.jpeg') || 
                              doc.documentUrl.includes('.png') || 
                              doc.documentUrl.includes('.gif') || 
                              doc.documentUrl.includes('.webp')
                            )
                            return (
                              <div key={doc.id} className="relative group border rounded-lg overflow-hidden">
                                <div className="aspect-square bg-muted relative overflow-hidden rounded-lg flex items-center justify-center">
                                  {isImage ? (
                                    <Image
                                      src={doc.documentUrl}
                                      alt={doc.fileName}
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    <FileText className="h-12 w-12 text-muted-foreground" />
                                  )}
                                  {uploadingDocuments && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                                      <div className="text-center">
                                        <div className="text-white text-sm font-medium mb-1">
                                          {Math.round(documentUploadProgress)}%
                                        </div>
                                        <div className="w-16 h-1 bg-white/30 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-white transition-all duration-300"
                                            style={{ width: `${documentUploadProgress}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {doc.fileName && !isImage && (
                                  <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] px-1 py-0.5 truncate rounded-b-lg">
                                    {doc.fileName}
                                  </div>
                                )}
                                {!uploadingDocuments && (
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="icon"
                                    className="absolute top-0 right-0 h-5 w-5 bg-red-500 hover:bg-red-400 rounded-tr-lg rounded-br-none rounded-tl-none z-20 shadow-lg"
                                    onClick={() => setSelectedExistingDocuments(prev => prev.filter(d => d.id !== doc.id))}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                          {selectedDocuments.map((file, index) => {
                            const isImage = file.type.startsWith('image/')
                            return (
                              <div key={`selected-doc-${index}`} className="relative group border rounded-lg overflow-hidden">
                                <div className="aspect-square bg-muted relative overflow-hidden rounded-lg flex items-center justify-center">
                                  {isImage ? (
                                    <Image
                                      src={selectedDocumentUrls[index]}
                                      alt={file.name}
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    <FileText className="h-12 w-12 text-muted-foreground" />
                                  )}
                                  {uploadingDocuments && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                                      <div className="text-center">
                                        <div className="text-white text-sm font-medium mb-1">
                                          {Math.round(documentUploadProgress)}%
                                        </div>
                                        <div className="w-16 h-1 bg-white/30 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-white transition-all duration-300"
                                            style={{ width: `${documentUploadProgress}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {file.name && !isImage && (
                                  <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] px-1 py-0.5 truncate rounded-b-lg">
                                    {file.name}
                                  </div>
                                )}
                                {!uploadingDocuments && (
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="icon"
                                    className="absolute top-0 right-0 h-5 w-5 bg-red-500 hover:bg-red-400 rounded-tr-lg rounded-br-none rounded-tl-none z-20 shadow-lg"
                                    onClick={() => setSelectedDocuments(prev => prev.filter((_, i) => i !== index))}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                          <div className="aspect-square border-2 border-dashed border-muted rounded-lg flex items-center justify-center">
                            <input
                              ref={documentInputRef}
                              type="file"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.rtf,.jpg,.jpeg,.png,.gif,.webp"
                              multiple
                              className="hidden"
                              onClick={(e) => {
                                // Prevent any accidental form submission
                                e.stopPropagation()
                              }}
                              onChange={(e) => {
                                e.stopPropagation()
                                const files = Array.from(e.target.files || [])
                                const allowedTypes = [
                                  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                  'text/plain', 'text/csv', 'application/rtf',
                                  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
                                ]
                                const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf', '.jpg', '.jpeg', '.png', '.gif', '.webp']
                                const maxSize = 5 * 1024 * 1024 // 5MB

                                const validFiles = files.filter(file => {
                                  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
                                  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
                                    toast.error(`${file.name} is not a valid document type. Only PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, RTF, JPEG, PNG, GIF, and WebP are allowed.`)
                                    return false
                                  }
                                  if (file.size > maxSize) {
                                    toast.error(`${file.name} is too large. Maximum size is 5MB.`)
                                    return false
                                  }
                                  return true
                                })

                                // Only add to state - upload will happen on form submit
                                setSelectedDocuments(prev => [...prev, ...validFiles])

                                if (documentInputRef.current) {
                                  documentInputRef.current.value = ''
                                }
                              }}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-full w-full"
                                >
                                  <Upload className="h-6 w-6" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    documentInputRef.current?.click()
                                  }}
                                >
                                  <Upload className="mr-2 h-4 w-4" />
                                  Upload Documents
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setDocumentBrowserOpen(true)
                                  }}
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Select from Media
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || uploadingImages || uploadingDocuments}>
                {updateMutation.isPending || uploadingImages || uploadingDocuments ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <MediaBrowserDialog
        open={mediaBrowserOpen}
        onOpenChange={setMediaBrowserOpen}
        selectedImages={selectedExistingImages}
        onSelectImages={setSelectedExistingImages}
        pageSize={24}
        currentAssetTagId={asset.assetTagId}
        existingImageUrls={existingImages.map((img: { imageUrl: string }) => img.imageUrl)}
      />

      <DocumentBrowserDialog
        open={documentBrowserOpen}
        onOpenChange={setDocumentBrowserOpen}
        selectedDocuments={selectedExistingDocuments}
        onSelectDocuments={setSelectedExistingDocuments}
        pageSize={24}
        currentAssetTagId={asset.assetTagId}
      />

      <DeleteConfirmationDialog
        open={isDeleteImageDialogOpen}
        onOpenChange={setIsDeleteImageDialogOpen}
        onConfirm={deleteExistingImage}
        title="Delete Image"
        description="Are you sure you want to delete this image? This action cannot be undone."
        confirmLabel="Delete Image"
        isLoading={isDeletingImage}
      />

      <DeleteConfirmationDialog
        open={isDeleteDocumentDialogOpen}
        onOpenChange={setIsDeleteDocumentDialogOpen}
        onConfirm={deleteExistingDocument}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
        confirmLabel="Delete Document"
        isLoading={isDeletingDocument}
      />

      {/* Unsaved Changes Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isUnsavedChangesDialogOpen}
        onOpenChange={setIsUnsavedChangesDialogOpen}
        onConfirm={handleDiscardChanges}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to close? All unsaved changes will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
      />

      {/* Download Confirmation Dialog */}
      <DownloadConfirmationDialog
        open={isDownloadDialogOpen}
        onOpenChange={setIsDownloadDialogOpen}
        fileName={documentToDownload?.fileName || null}
        fileSize={documentToDownload?.documentSize || null}
        onConfirm={() => {
          if (documentToDownload) {
            // Create a temporary anchor element to trigger download
            const link = document.createElement('a')
            link.href = documentToDownload.documentUrl
            link.download = documentToDownload.fileName || 'download'
            link.target = '_blank'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
          }
          setDocumentToDownload(null)
        }}
        onCancel={() => {
          setDocumentToDownload(null)
        }}
      />

      {/* Image Preview Dialog */}
      <ImagePreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        existingImages={
          previewSource === 'images'
            ? existingImages.map((img: { id: string; imageUrl: string; assetTagId: string; fileName?: string; createdAt?: string }) => ({
                id: img.id,
                imageUrl: img.imageUrl,
                fileName: img.fileName || `Image ${img.id}`,
              }))
            : existingDocuments
                .filter((doc: { mimeType?: string | null; fileName?: string }) => {
                  const isImage = doc.mimeType?.startsWith('image/') || 
                    /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
                  return isImage
                })
                .map((doc: { id: string; documentUrl: string; fileName?: string }) => ({
                  id: doc.id,
                  imageUrl: doc.documentUrl,
                  fileName: doc.fileName || `Document ${doc.id}`,
                }))
        }
        title={previewSource === 'images' ? `Asset Images - ${asset.assetTagId}` : `Asset Documents - ${asset.assetTagId}`}
        maxHeight="h-[70vh] max-h-[600px]"
        initialIndex={previewImageIndex}
      />
    </>
  )
}

