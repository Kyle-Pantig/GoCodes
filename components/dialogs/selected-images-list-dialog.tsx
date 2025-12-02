'use client'

import { useMemo, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SelectedImagesListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images?: File[]
  existingImages?: Array<{ id: string; imageUrl: string; fileName: string }>
  onRemoveImage?: (index: number) => void
  onRemoveExistingImage?: (id: string) => void
  title?: string
  description?: string
}

export function SelectedImagesListDialog({
  open,
  onOpenChange,
  images = [],
  existingImages = [],
  onRemoveImage,
  onRemoveExistingImage,
  title = 'Selected Images',
  description = 'Preview and manage your selected images. Click the remove button to remove an image from the list.',
}: SelectedImagesListDialogProps) {
  // Create object URLs for file images
  const fileImageUrls = useMemo(() => {
    return images.map(file => URL.createObjectURL(file))
  }, [images])

  // Cleanup object URLs on unmount or when images change
  useEffect(() => {
    return () => {
      fileImageUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [fileImageUrls])

  const totalImages = images.length + existingImages.length

  if (totalImages === 0) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[70vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <ScrollArea className="max-h-[35vh]">
          <div >
            {/* File images */}
            {images.map((file, index) => (
              <div
                key={`file-${index}`}
                className="flex items-center gap-2 p-2 border-b last:border-b-0 rounded-none hover:bg-accent/50 transition-colors"
              >
                <div className="relative w-12 h-12 shrink-0 rounded-md overflow-hidden bg-muted">
                  <Image
                    src={fileImageUrls[index]}
                    alt={file.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate max-w-xs">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                {onRemoveImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onRemoveImage(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}

            {/* Existing images */}
            {existingImages.map((img) => (
              <div
                key={img.id}
                className="flex items-center gap-2 p-2 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="relative w-12 h-12 shrink-0 rounded-md overflow-hidden bg-muted">
                  <Image
                    src={img.imageUrl}
                    alt={img.fileName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{img.fileName}</p>
                  <p className="text-xs text-muted-foreground">Existing image</p>
                </div>
                {onRemoveExistingImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onRemoveExistingImage(img.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

