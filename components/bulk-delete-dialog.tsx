'use client'

import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface BulkDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  itemCount: number
  itemName?: string
  isDeleting?: boolean
  progress?: {
    current: number
    total: number
  }
  title?: string
  description?: string
  confirmLabel?: string
  loadingLabel?: string
  progressTitle?: string
  variant?: 'delete' | 'restore'
}

export function BulkDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  itemCount,
  itemName = 'item',
  isDeleting = false,
  progress,
  title,
  description,
  confirmLabel,
  loadingLabel,
  progressTitle,
  variant = 'delete',
}: BulkDeleteDialogProps) {
  const canClose = !isDeleting

  const handleOpenChange = (newOpen: boolean) => {
    if (canClose) {
      onOpenChange(newOpen)
    }
  }

  const progressPercentage = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  // Only assets use "Move to Trash" - media and documents are permanently deleted
  const isAsset = itemName === 'Asset'
  const isRestore = variant === 'restore'

  // Use custom title if provided, otherwise use default
  const dialogTitle = title || (isDeleting
    ? progressTitle || (isRestore
      ? `Restoring ${itemName}s... ${progress?.current || 0}/${progress?.total || 0}`
      : isAsset
        ? `Moving ${itemName}s to Trash... ${progress?.current || 0}/${progress?.total || 0}`
        : `Deleting ${itemName}s... ${progress?.current || 0}/${progress?.total || 0}`)
    : isRestore
      ? `Restore ${itemCount} ${itemName}(s)?`
      : isAsset
        ? `Move ${itemCount} ${itemName}(s) to Trash?`
        : `Delete ${itemCount} ${itemName}(s)?`)

  // Use custom description if provided, otherwise use default
  const dialogDescription = description || (isRestore
    ? `${itemCount} selected ${itemName}${itemCount !== 1 ? 's' : ''} will be restored and made available again.`
    : isAsset
      ? `${itemCount} selected ${itemName}${itemCount !== 1 ? 's' : ''} will be moved to Trash and can be restored later if needed.`
      : `Are you sure you want to permanently delete ${itemCount} selected ${itemName}(s)? This action cannot be undone and will permanently remove these ${itemName}s.`)

  // Use custom loading label if provided, otherwise use default
  const loadingText = loadingLabel || (isRestore
    ? `Restoring ${itemName}s, please wait...`
    : isAsset
      ? `Moving ${itemName}s to Trash, please wait...`
      : `Deleting ${itemName}s, please wait...`)

  // Use custom confirm label if provided, otherwise use default
  const buttonLabel = confirmLabel || (isRestore
    ? `Restore ${itemCount} ${itemName}(s)`
    : isAsset
      ? `Move ${itemCount} ${itemName}(s) to Trash`
      : `Delete ${itemCount} ${itemName}(s)`)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {dialogTitle}
          </DialogTitle>
          {isDeleting ? (
            <div className="space-y-2">
              <span className="text-muted-foreground text-sm">
                {loadingText}
              </span>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-destructive h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground">{progressPercentage}% complete</span>
            </div>
          ) : (
            <DialogDescription>
              {dialogDescription}
            </DialogDescription>
          )}
        </DialogHeader>
        {!isDeleting && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant={isRestore ? 'default' : 'destructive'} onClick={onConfirm}>
              {isRestore ? null : <Trash2 className="mr-2 h-4 w-4" />}
              {buttonLabel}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

