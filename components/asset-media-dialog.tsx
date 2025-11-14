'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { ImageIcon, FileText } from 'lucide-react'
import { ImagePreviewDialog } from '@/components/image-preview-dialog'
import { DownloadConfirmationDialog } from '@/components/download-confirmation-dialog'

interface Asset {
  assetTagId: string
  category?: {
    name: string
  } | null
  subCategory?: {
    name: string
  } | null
  description?: string
  imagesCount?: number
}

interface AssetMediaDialogProps {
  asset: Asset
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: React.ReactNode
}

export function AssetMediaDialog({
  asset,
  open,
  onOpenChange,
  trigger,
}: AssetMediaDialogProps) {
  const [activeTab, setActiveTab] = useState<'images' | 'documents'>('images')
  const [images, setImages] = useState<Array<{ id: string; imageUrl: string; assetTagId: string; fileName?: string; createdAt?: string }>>([])
  const [documents, setDocuments] = useState<Array<{ id: string; documentUrl: string; assetTagId: string; fileName?: string; mimeType?: string | null; documentSize?: number | null; createdAt?: string }>>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewSource, setPreviewSource] = useState<'images' | 'documents'>('images')
  const [documentToDownload, setDocumentToDownload] = useState<{ id: string; documentUrl: string; fileName?: string; mimeType?: string | null; documentSize?: number | null } | null>(null)
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false)

  const fetchImages = async () => {
    if (!open) return
    
    setLoadingImages(true)
    try {
      const response = await fetch(`/api/assets/images/${asset.assetTagId}`)
      if (response.ok) {
        const data = await response.json()
        setImages(data.images || [])
      } else {
        setImages([])
      }
    } catch (error) {
      console.error('Error fetching images:', error)
      setImages([])
    } finally {
      setLoadingImages(false)
    }
  }

  const fetchDocuments = async () => {
    if (!open) return
    
    setLoadingDocuments(true)
    try {
      const response = await fetch(`/api/assets/documents/${asset.assetTagId}`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      } else {
        setDocuments([])
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
      setDocuments([])
    } finally {
      setLoadingDocuments(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchImages()
      fetchDocuments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleImageClick = (index: number) => {
    setPreviewSource('images')
    setPreviewImageIndex(index)
    setIsPreviewOpen(true)
    // Don't close the media dialog - keep it open so user can navigate back
  }

  const handleDocumentClick = (doc: { id: string; documentUrl: string; fileName?: string; mimeType?: string | null; documentSize?: number | null }) => {
    const isImage = doc.mimeType?.startsWith('image/') || 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
    
    if (isImage) {
      // Find index of this document among image documents
      const imageDocuments = documents.filter(document => {
        const docIsImage = document.mimeType?.startsWith('image/') || 
          /\.(jpg|jpeg|png|gif|webp)$/i.test(document.fileName || '')
        return docIsImage
      })
      const index = imageDocuments.findIndex(document => document.id === doc.id)
      if (index >= 0) {
        setPreviewSource('documents')
        setPreviewImageIndex(index)
        setIsPreviewOpen(true)
        // Don't close the media dialog - keep it open so user can navigate back
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
  }

  const existingImagesForPreview = previewSource === 'images'
    ? images.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        fileName: img.fileName || `Image ${img.id}`,
      }))
    : documents
        .filter(doc => {
          const isImage = doc.mimeType?.startsWith('image/') || 
            /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
          return isImage
        })
        .map(doc => ({
          id: doc.id,
          imageUrl: doc.documentUrl,
          fileName: doc.fileName || `Document ${doc.id}`,
        }))

  const isImageDocument = (document: { mimeType?: string | null; fileName?: string }): boolean => {
    return document.mimeType?.startsWith('image/') || 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(document.fileName || '')
  }

  const description = asset.category?.name && asset.subCategory?.name
    ? `${asset.category.name} - ${asset.subCategory.name}`
    : asset.description || ''

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Asset Media - {asset.assetTagId}</DialogTitle>
            <DialogDescription>
              Images and documents for {description}
            </DialogDescription>
          </DialogHeader>
          
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b">
            <button
              onClick={() => setActiveTab('images')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'images'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Images ({images.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'documents'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents ({documents.length})
              </div>
            </button>
          </div>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {activeTab === 'images' ? (
              <>
                {loadingImages ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner className="h-6 w-6" />
                  </div>
                ) : images.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No images found for this asset
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {images.map((image, index) => (
                      <div
                        key={image.id}
                        className="relative group rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleImageClick(index)}
                      >
                        <div className="aspect-square bg-muted relative">
                          <Image
                            src={image.imageUrl}
                            alt={`Asset ${asset.assetTagId} image`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {loadingDocuments ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner className="h-6 w-6" />
                  </div>
                ) : documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No documents found for this asset
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {documents.map((document) => {
                      const isImage = isImageDocument(document)
                      return (
                        <div
                          key={document.id}
                          className="relative group rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleDocumentClick(document)}
                        >
                          <div className="aspect-square bg-muted relative flex items-center justify-center">
                            {isImage ? (
                              <Image
                                src={document.documentUrl}
                                alt={document.fileName || 'Document'}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <FileText className="h-12 w-12 text-muted-foreground" />
                            )}
                          </div>
                          {document.fileName && (
                            <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-xs px-2 py-1 truncate">
                              {document.fileName}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <ImagePreviewDialog
        open={isPreviewOpen}
        onOpenChange={(open) => {
          setIsPreviewOpen(open)
          // If preview is closed, don't close the media dialog
        }}
        existingImages={existingImagesForPreview}
        title={previewSource === 'images' ? `Asset Images - ${asset.assetTagId}` : `Asset Documents - ${asset.assetTagId}`}
        maxHeight="h-[70vh] max-h-[600px]"
        initialIndex={previewImageIndex}
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
    </>
  )
}

