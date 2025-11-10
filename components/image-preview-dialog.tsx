'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import Image from 'next/image'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from '@/components/ui/carousel'

export interface ImagePreviewData {
  imageUrl: string
  fileName?: string
  assetTagId?: string | null
  linkedAssetTagIds?: string[]
  linkedAssetTagId?: string | null
  createdAt?: string
  alt?: string
}

interface ImagePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  image?: ImagePreviewData | null
  images?: File[]
  existingImages?: Array<{ id: string; imageUrl: string; fileName: string }>
  onRemoveImage?: (index: number) => void
  onRemoveExistingImage?: (id: string) => void
  title?: string
  description?: string
  maxHeight?: string
  initialIndex?: number
}

export function ImagePreviewDialog({
  open,
  onOpenChange,
  image,
  images = [],
  existingImages = [],
  onRemoveImage,
  onRemoveExistingImage,
  title,
  description,
  maxHeight = 'h-[50vh] max-h-[500px]',
  initialIndex = 0,
}: ImagePreviewDialogProps) {
  // Combine all images into a single array for navigation
  const allImages = useMemo(() => {
    const fileImages = images.map((file, index) => ({
      id: `file-${index}`,
      imageUrl: URL.createObjectURL(file),
      fileName: file.name,
      type: 'file' as const,
      index,
    }))
    
    const existing = existingImages.map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      fileName: img.fileName,
      type: 'existing' as const,
    }))
    
    return [...fileImages, ...existing]
  }, [images, existingImages])

  // Support single image mode (backward compatibility)
  const singleImage = image
  const hasMultipleImages = allImages.length > 0
  const totalImages = hasMultipleImages ? allImages.length : (singleImage ? 1 : 0)

  const [api, setApi] = useState<CarouselApi>()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  // Update current index when carousel changes
  useEffect(() => {
    if (!api) return

    const updateIndex = () => {
      setCurrentIndex(api.selectedScrollSnap())
    }

    updateIndex()
    api.on('select', updateIndex)

    return () => {
      api.off('select', updateIndex)
    }
  }, [api])

  // Scroll to initial index when dialog opens
  useEffect(() => {
    if (!api || !open || !hasMultipleImages) return

    const validIndex = Math.max(0, Math.min(initialIndex, allImages.length - 1))
    api.scrollTo(validIndex)
  }, [api, open, hasMultipleImages, initialIndex, allImages.length])

  const handleRemove = useCallback(() => {
    if (!hasMultipleImages || !api) return

    const selectedIndex = api.selectedScrollSnap()
    const currentImage = allImages[selectedIndex]
    
    if (!currentImage) return

    if (currentImage.type === 'file' && onRemoveImage) {
      onRemoveImage(currentImage.index)
      // If removing the last image, go to previous
      if (selectedIndex === allImages.length - 1 && selectedIndex > 0) {
        api.scrollTo(selectedIndex - 1)
      }
    } else if (currentImage.type === 'existing' && onRemoveExistingImage) {
      onRemoveExistingImage(currentImage.id)
      // If removing the last image, go to previous
      if (selectedIndex === allImages.length - 1 && selectedIndex > 0) {
        api.scrollTo(selectedIndex - 1)
      }
    }
  }, [hasMultipleImages, api, allImages, onRemoveImage, onRemoveExistingImage])

  // Get current image for display in title
  const getCurrentDisplayImage = () => {
    if (hasMultipleImages) {
      const selectedIndex = currentIndex
      const currentImg = allImages[selectedIndex]
      if (currentImg) {
        return {
          fileName: currentImg.fileName,
          assetTagId: null,
          linkedAssetTagIds: undefined,
          linkedAssetTagId: null,
          createdAt: undefined,
        }
      }
    }
    return singleImage
  }

  const displayImage = getCurrentDisplayImage()

  if (!hasMultipleImages && !singleImage) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-2xl sm:!max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            <div className="space-y-1">
              <div>{title || displayImage?.fileName || displayImage?.assetTagId || 'Image'}</div>
              {hasMultipleImages && (
                <div className="text-sm text-muted-foreground font-normal">
                  {currentIndex + 1} of {totalImages}
                </div>
              )}
              {/* Only show asset info if the image is actually linked to an asset */}
              {displayImage?.linkedAssetTagIds && displayImage.linkedAssetTagIds.length > 0 && (
                <div className="text-sm text-muted-foreground font-normal">
                  Asset{displayImage.linkedAssetTagIds.length > 1 ? 's' : ''}: {displayImage.linkedAssetTagIds.join(', ')}
                </div>
              )}
              {displayImage?.linkedAssetTagId && !displayImage.linkedAssetTagIds && (
                <div className="text-sm text-muted-foreground font-normal">
                  Asset: {displayImage.linkedAssetTagId}
                </div>
              )}
              {displayImage?.createdAt && (
                <div className="text-sm text-muted-foreground font-normal">
                  {format(new Date(displayImage.createdAt), 'PPp')}
                </div>
              )}
            </div>
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <div className="mt-4 relative">
          {hasMultipleImages ? (
            <Carousel
              setApi={setApi}
              opts={{
                align: 'start',
                loop: false,
              }}
              className="w-full"
            >
              <CarouselContent>
                {allImages.map((img, index) => (
                  <CarouselItem key={img.id} className="flex items-center justify-center">
                    <div className={`relative w-full ${maxHeight} overflow-hidden`}>
                      <Image
                        src={img.imageUrl}
                        alt={img.fileName || `Image ${index + 1}`}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {allImages.length > 1 && (
                <>
                  <CarouselPrevious className="left-2" />
                  <CarouselNext className="right-2" />
                </>
              )}
            </Carousel>
          ) : singleImage ? (
            <div className={`relative w-full ${maxHeight} overflow-hidden`}>
              <Image
                src={singleImage.imageUrl}
                alt={singleImage.alt || `Image ${singleImage.fileName || singleImage.assetTagId || ''}`}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : null}
          
          {/* Remove button for multiple images */}
          {hasMultipleImages && (onRemoveImage || onRemoveExistingImage) && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 z-10"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
