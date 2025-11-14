"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { PlusIcon, Link2, FileText, FileImage } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/shadcn-io/spinner"

interface MediaDocument {
  id: string
  documentUrl: string
  fileName: string
  assetTagId: string
  mimeType?: string | null
  isLinked?: boolean
  linkedAssetTagId?: string | null
  linkedAssetTagIds?: string[]
  linkedAssetsInfo?: Array<{ assetTagId: string; isDeleted: boolean }>
  assetIsDeleted?: boolean
}

interface DocumentBrowserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectDocuments: (documents: Array<{ id: string; documentUrl: string; fileName: string }>) => void
  selectedDocuments?: Array<{ id: string; documentUrl: string; fileName: string }>
  pageSize?: number
  currentAssetTagId?: string
}

export function DocumentBrowserDialog({
  open,
  onOpenChange,
  onSelectDocuments,
  selectedDocuments = [],
  pageSize = 24,
  currentAssetTagId,
}: DocumentBrowserDialogProps) {
  const [documentsPage, setDocumentsPage] = useState(1)
  const prevOpenRef = useRef(false)
  
  const getInitialSelection = () => new Set(selectedDocuments.map(doc => doc.id))
  const [localSelectedDocuments, setLocalSelectedDocuments] = useState<Set<string>>(getInitialSelection)

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const initialIds = new Set(selectedDocuments.map(doc => doc.id))
      setTimeout(() => {
        setLocalSelectedDocuments(initialIds)
      }, 0)
    }
    prevOpenRef.current = open
  }, [open, selectedDocuments])

  const { data: documentsData, isLoading: documentsLoading } = useQuery({
    queryKey: ['assets', 'documents', 'browser', documentsPage, pageSize],
    queryFn: async () => {
      const response = await fetch(`/api/assets/documents?page=${documentsPage}&pageSize=${pageSize}`)
      if (!response.ok) throw new Error('Failed to fetch documents')
      return response.json() as Promise<{
        documents: MediaDocument[]
        pagination: { total: number; page: number; pageSize: number; totalPages: number }
      }>
    },
    enabled: open,
  })

  const handleDocumentClick = (document: MediaDocument) => {
    const isAlreadyLinked = currentAssetTagId && document.isLinked && (
      document.linkedAssetTagId === currentAssetTagId ||
      (document.linkedAssetTagIds && document.linkedAssetTagIds.includes(currentAssetTagId))
    )
    
    if (isAlreadyLinked) {
      return
    }

    const isSelected = localSelectedDocuments.has(document.id)
    const newSelected = new Set(localSelectedDocuments)
    
    if (isSelected) {
      newSelected.delete(document.id)
    } else {
      newSelected.add(document.id)
    }
    
    setLocalSelectedDocuments(newSelected)
    
    const selectedArray = Array.from(newSelected)
      .map(id => {
        const doc = documentsData?.documents.find(d => d.id === id)
        return doc ? { id: doc.id, documentUrl: doc.documentUrl, fileName: doc.fileName } : null
      })
      .filter((doc): doc is { id: string; documentUrl: string; fileName: string } => doc !== null)
    
    onSelectDocuments(selectedArray)
  }

  const handleClearSelection = () => {
    setLocalSelectedDocuments(new Set())
    onSelectDocuments([])
  }

  const handleDone = () => {
    onOpenChange(false)
  }

  const getAssetColor = (assetTagId: string | null | undefined): string => {
    if (!assetTagId) return 'bg-blue-500/90'

    let hash = 0
    for (let i = 0; i < assetTagId.length; i++) {
      hash = assetTagId.charCodeAt(i) + ((hash << 5) - hash)
    }

    const colors = [
      'bg-blue-500/90', 'bg-green-500/90', 'bg-purple-500/90', 'bg-orange-500/90', 'bg-pink-500/90',
      'bg-cyan-500/90', 'bg-yellow-500/90', 'bg-indigo-500/90', 'bg-red-500/90', 'bg-teal-500/90',
      'bg-amber-500/90', 'bg-violet-500/90', 'bg-emerald-500/90', 'bg-lime-500/90', 'bg-rose-500/90',
      'bg-fuchsia-500/90', 'bg-sky-500/90', 'bg-slate-500/90', 'bg-gray-500/90', 'bg-zinc-500/90',
      'bg-neutral-500/90', 'bg-stone-500/90',
      'bg-blue-600/90', 'bg-green-600/90', 'bg-purple-600/90', 'bg-orange-600/90', 'bg-pink-600/90',
      'bg-cyan-600/90', 'bg-yellow-600/90', 'bg-indigo-600/90', 'bg-red-600/90', 'bg-teal-600/90',
      'bg-amber-600/90', 'bg-violet-600/90', 'bg-emerald-600/90', 'bg-lime-600/90', 'bg-rose-600/90',
      'bg-fuchsia-600/90', 'bg-sky-600/90',
      'bg-blue-400/90', 'bg-green-400/90', 'bg-purple-400/90', 'bg-orange-400/90', 'bg-pink-400/90',
      'bg-cyan-400/90', 'bg-yellow-400/90', 'bg-indigo-400/90', 'bg-red-400/90', 'bg-teal-400/90',
      'bg-amber-400/90', 'bg-violet-400/90', 'bg-emerald-400/90', 'bg-lime-400/90', 'bg-rose-400/90',
      'bg-fuchsia-400/90', 'bg-sky-400/90',
    ]
    const index = Math.abs(hash) % colors.length
    return colors[index]
  }

  const getDocumentColor = (document: MediaDocument): string => {
    if (document.assetIsDeleted) return 'bg-gray-500/90'
    
    if (document.linkedAssetTagIds && document.linkedAssetTagIds.length > 1) {
      return 'bg-gradient-to-br from-purple-500/90 to-indigo-500/90'
    }
    
    return getAssetColor(document.linkedAssetTagId)
  }

  const isImageDocument = (document: MediaDocument): boolean => {
    return document.mimeType?.startsWith('image/') || 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(document.fileName || '')
  }

  const getFileTypeIcon = (fileName: string, mimeType?: string | null) => {
    if (mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)) {
      return FileImage
    }
    
    if (/\.pdf$/i.test(fileName) || mimeType === 'application/pdf') {
      return FileText
    }
    
    if (/\.(doc|docx)$/i.test(fileName) || mimeType?.includes('word')) {
      return FileText
    }
    
    if (/\.(xls|xlsx)$/i.test(fileName) || mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) {
      return FileText
    }
    
    return FileText
  }

  const getFileTypeLabel = (fileName: string, mimeType?: string | null): string => {
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    
    if (mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)) {
      return 'Image'
    }
    
    if (/\.pdf$/i.test(fileName) || mimeType === 'application/pdf') {
      return 'PDF'
    }
    
    if (/\.(doc|docx)$/i.test(fileName) || mimeType?.includes('word')) {
      return 'Word'
    }
    
    if (/\.(xls|xlsx)$/i.test(fileName) || mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) {
      return 'Excel'
    }
    
    if (/\.txt$/i.test(fileName) || mimeType === 'text/plain') {
      return 'Text'
    }
    
    if (/\.csv$/i.test(fileName) || mimeType === 'text/csv') {
      return 'CSV'
    }
    
    return extension.toUpperCase() || 'File'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Browse Document Library</DialogTitle>
          <DialogDescription>
            Select documents to link to this asset. You can select multiple documents.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          {documentsLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Spinner className="h-6 w-6" />
              <p className="text-sm text-muted-foreground">Loading document library...</p>
            </div>
          ) : documentsData?.documents ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {documentsData.documents.map((document) => {
                const isSelected = localSelectedDocuments.has(document.id)
                const isAlreadyLinked = currentAssetTagId && document.isLinked && (
                  document.linkedAssetTagId === currentAssetTagId ||
                  (document.linkedAssetTagIds && document.linkedAssetTagIds.includes(currentAssetTagId))
                )
                const isImage = isImageDocument(document)
                
                const FileIcon = getFileTypeIcon(document.fileName || '', document.mimeType)
                const fileTypeLabel = getFileTypeLabel(document.fileName || '', document.mimeType)
                
                return (
                  <div
                    key={document.id}
                    className={`relative aspect-square group rounded ${
                      isAlreadyLinked 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'cursor-pointer'
                    }`}
                    onClick={() => handleDocumentClick(document)}
                    title={document.fileName || 'Document'}
                  >
                    {isImage ? (
                      <Image
                        src={document.documentUrl}
                        alt={document.fileName}
                        fill
                        className="object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-muted rounded p-1">
                        <FileIcon className="h-8 w-8 text-muted-foreground mb-1" />
                        <span className="text-[10px] text-muted-foreground font-medium truncate w-full text-center px-1">
                          {fileTypeLabel}
                        </span>
                      </div>
                    )}
                    
                    {/* File name overlay on hover */}
                    {!isImage && (
                      <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] px-1 py-0.5 rounded-b opacity-0 group-hover:opacity-100 transition-opacity truncate">
                        {document.fileName}
                      </div>
                    )}
                    
                    {document.isLinked && (
                      <div className="absolute -top-1 -left-1 z-10">
                        <div 
                          className={`${getDocumentColor(document)} text-white p-1 rounded-full shadow-lg transition-colors`}
                          title={
                            document.linkedAssetTagIds && document.linkedAssetTagIds.length > 1
                              ? isAlreadyLinked
                                ? `Already linked to this asset (and ${document.linkedAssetTagIds.length - 1} other asset${document.linkedAssetTagIds.length - 1 !== 1 ? 's' : ''})`
                                : `Linked to ${document.linkedAssetTagIds.length} assets`
                              : document.linkedAssetTagId 
                                ? document.assetIsDeleted 
                                  ? `Linked to archived asset: ${document.linkedAssetTagId}`
                                  : isAlreadyLinked
                                    ? `Already linked to this asset: ${document.linkedAssetTagId}`
                                    : `Linked to asset: ${document.linkedAssetTagId}`
                                : 'Linked to asset'
                          }
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <Link2 className="h-2.5 w-2.5" />
                        </div>
                      </div>
                    )}
                    
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/30 flex items-center justify-center z-20">
                        <div className="bg-primary text-white rounded-full p-2">
                          <PlusIcon className="h-5 w-5" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No documents found
            </div>
          )}
        </div>

        {documentsData?.pagination && documentsData.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDocumentsPage(p => Math.max(1, p - 1))}
              disabled={documentsPage === 1 || documentsLoading}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {documentsData.pagination.page} of {documentsData.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDocumentsPage(p => Math.min(documentsData.pagination.totalPages, p + 1))}
              disabled={documentsPage >= documentsData.pagination.totalPages || documentsLoading}
            >
              Next
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {localSelectedDocuments.size} document{localSelectedDocuments.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClearSelection}
            >
              Clear Selection
            </Button>
            <Button onClick={handleDone}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

