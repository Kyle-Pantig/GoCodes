'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { QrCode, Upload, CheckCircle2, X } from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface QRScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (decodedText: string) => void | Promise<void>
  onRemove?: (decodedText: string) => void | Promise<void> // Callback when a code is removed
  title?: string
  description?: string
  scanButtonLabel?: string
  uploadButtonLabel?: string
  multiScan?: boolean // Enable multiple scans without closing
  existingCodes?: string[] // Already scanned/added codes to prevent duplicates
}

export function QRScannerDialog({
  open,
  onOpenChange,
  onScan,
  onRemove,
  title = 'QR Code Scanner',
  description = 'Scan or upload a QR code',
  scanButtonLabel = 'Scan',
  uploadButtonLabel = 'Upload',
  multiScan = false,
  existingCodes = [],
}: QRScannerDialogProps) {
  const qrScanContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastScannedRef = useRef<string>('')
  const lastScanTimeRef = useRef<number>(0)
  const processedCodesRef = useRef<Set<string>>(new Set()) // Track all processed codes (existing + newly scanned)
  const [qrMode, setQrMode] = useState<'scan' | 'upload'>('scan')
  const [scannedCode, setScannedCode] = useState<string>('')
  const [scannedCodes, setScannedCodes] = useState<string[]>([]) // Track multiple scans in this session
  const [isProcessing, setIsProcessing] = useState(false)

  // Calculate unique codes for display
  const uniqueDisplayCodes = useMemo(() => {
    const uniqueExisting = Array.from(new Set(existingCodes))
    const uniqueNew = Array.from(new Set(scannedCodes)).filter(code => !existingCodes.includes(code))
    return {
      existing: uniqueExisting,
      new: uniqueNew,
      total: uniqueExisting.length + uniqueNew.length
    }
  }, [existingCodes, scannedCodes])

  // Handle removing a scanned code
  const handleRemoveCode = async (codeToRemove: string) => {
    const isExisting = existingCodes.includes(codeToRemove)
    
    // Remove from scannedCodes state (if it's a newly scanned code)
    if (!isExisting) {
      setScannedCodes((prev) => prev.filter((code) => code !== codeToRemove))
    }
    
    // Remove from processed set (allows re-scanning)
    processedCodesRef.current.delete(codeToRemove)
    
    // Reset refs to allow immediate re-scanning
    if (lastScannedRef.current === codeToRemove) {
      lastScannedRef.current = ''
      lastScanTimeRef.current = 0
    }
    
    // Call onRemove callback if provided (to remove from form)
    // This works for both existing and newly scanned codes
    if (onRemove) {
      try {
        await onRemove(codeToRemove)
      } catch (error) {
        console.error('Error in onRemove callback:', error)
        toast.error('Failed to remove asset from form')
        // Re-add to processed set and scannedCodes if removal failed
        processedCodesRef.current.add(codeToRemove)
        if (!isExisting) {
          setScannedCodes((prev) => [...prev, codeToRemove])
        }
        return
      }
    }
    
    toast.success(`Removed: ${codeToRemove}`)
  }

  // Initialize processed codes set with existing codes when dialog opens
  useEffect(() => {
    if (open) {
      // Reset and populate with existing codes
      processedCodesRef.current = new Set(existingCodes)
    } else {
      // Reset everything when dialog closes
      setTimeout(() => {
        setScannedCode('')
        setScannedCodes([])
        setIsProcessing(false)
        lastScannedRef.current = ''
        lastScanTimeRef.current = 0
        processedCodesRef.current = new Set()
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }, 0)
    }
  }, [open, existingCodes])

  // Handle QR code scan result
  const handleQRScanResult = async (
    results: Array<{ rawValue?: string; text?: string }> | string | undefined
  ) => {
    if (!results) return

    let decodedText: string | undefined

    // Handle different result types
    if (typeof results === 'string') {
      decodedText = results
    } else if (Array.isArray(results) && results.length > 0) {
      const result = results[0]
      decodedText = result.rawValue || result.text || (typeof result === 'string' ? result : undefined)
    }

    if (!decodedText || !decodedText.trim()) return

    const trimmedText = decodedText.trim()

    // Early return if already processing
    if (isProcessing) return

    // Prevent rapid duplicate scans (debounce) - check refs first
    const now = Date.now()
    if (trimmedText === lastScannedRef.current && now - lastScanTimeRef.current < 3000) {
      // Same code scanned within 3 seconds - ignore
      return
    }

    // Check if already processed (using Set for O(1) lookup)
    if (processedCodesRef.current.has(trimmedText)) {
      toast.info(`QR code "${trimmedText}" already scanned`)
      return
    }

    // Mark as processing immediately to prevent race conditions
    setIsProcessing(true)
    
    // Update refs immediately to prevent rapid duplicates
    lastScannedRef.current = trimmedText
    lastScanTimeRef.current = now
    
    // Add to processed set immediately
    processedCodesRef.current.add(trimmedText)
    
    setScannedCode(trimmedText)

    // Add to scanned codes list in multi-scan mode (for display)
    if (multiScan) {
      setScannedCodes((prev) => {
        // Double-check to prevent duplicates in the array
        if (prev.includes(trimmedText)) {
          return prev
        }
        return [...prev, trimmedText]
      })
    }

    // Call the onScan callback
    try {
      await onScan(trimmedText)
      
      // In multi-scan mode, keep dialog open and show success
      if (multiScan) {
        toast.success(`Scanned: ${trimmedText}`)
        // Reset scanned code after a brief delay to allow scanning again
        setTimeout(() => {
          setScannedCode('')
          setIsProcessing(false)
        }, 1500)
      } else {
        // Single scan mode - close dialog
        onOpenChange(false)
        setIsProcessing(false)
      }
    } catch {
      // Don't show generic error toast or log - the onScan callback already shows specific error messages
      setIsProcessing(false)
      
      // Remove from processed set and scanned codes if it failed
      processedCodesRef.current.delete(trimmedText)
      if (multiScan) {
        setScannedCodes((prev) => prev.filter((code) => code !== trimmedText))
      }
      // Reset refs on error
      lastScannedRef.current = ''
      lastScanTimeRef.current = 0
    }
  }

  // Handle QR code upload
  const handleQRUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || isProcessing) {
      return
    }

    let html5QrCode: Html5Qrcode | null = null

    try {
      setIsProcessing(true)
      html5QrCode = new Html5Qrcode('qr-reader')

      const decodedText = await html5QrCode.scanFile(file, false)

      // Clean up the scanner
      try {
        html5QrCode.clear()
      } catch {
        // Ignore cleanup errors
      }
      html5QrCode = null

      const trimmedText = decodedText.trim()

      // Early return if already processing
      if (isProcessing) {
        setIsProcessing(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        return
      }

      // Prevent rapid duplicate scans (debounce)
      const now = Date.now()
      if (trimmedText === lastScannedRef.current && now - lastScanTimeRef.current < 3000) {
        setIsProcessing(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        return
      }

      // Check if already processed (using Set for O(1) lookup)
      if (processedCodesRef.current.has(trimmedText)) {
        toast.info(`QR code "${trimmedText}" already scanned`)
        setIsProcessing(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        return
      }

      // Mark as processing immediately
      setIsProcessing(true)
      
      // Update refs immediately
      lastScannedRef.current = trimmedText
      lastScanTimeRef.current = now
      
      // Add to processed set immediately
      processedCodesRef.current.add(trimmedText)

      setScannedCode(trimmedText)

      // Add to scanned codes list in multi-scan mode
      if (multiScan) {
        setScannedCodes((prev) => {
          // Double-check to prevent duplicates
          if (prev.includes(trimmedText)) {
            return prev
          }
          return [...prev, trimmedText]
        })
      }

      // Call the onScan callback
      try {
        await onScan(trimmedText)
        
        // In multi-scan mode, keep dialog open
        if (multiScan) {
          toast.success(`Scanned: ${trimmedText}`)
          setTimeout(() => {
            setScannedCode('')
            setIsProcessing(false)
          }, 1000)
        } else {
          onOpenChange(false)
          setIsProcessing(false)
        }
      } catch {
        // Don't show generic error toast or log - the onScan callback already shows specific error messages
        setIsProcessing(false)
        
        // Remove from processed set and scanned codes if it failed
        processedCodesRef.current.delete(trimmedText)
        if (multiScan) {
          setScannedCodes((prev) => prev.filter((code) => code !== trimmedText))
        }
        // Reset refs on error
        lastScannedRef.current = ''
        lastScanTimeRef.current = 0
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Error scanning QR code:', err)
      toast.error('Failed to scan QR code from image. Please try again.')
      setIsProcessing(false)

      // Clean up on error
      if (html5QrCode) {
        try {
          html5QrCode.clear()
        } catch {
          // Ignore cleanup errors
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant={qrMode === 'scan' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setQrMode('scan')}
            >
              <QrCode className="mr-2 h-4 w-4" />
              {scanButtonLabel}
            </Button>
            <Button
              type="button"
              variant={qrMode === 'upload' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => {
                setQrMode('upload')
                setTimeout(() => {
                  fileInputRef.current?.click()
                }, 100)
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadButtonLabel}
            </Button>
          </div>

          {/* Scan Mode */}
          {qrMode === 'scan' && (
            <div className="flex flex-col items-center justify-center py-4">
              <div ref={qrScanContainerRef} className="w-full max-w-sm">
                {open && (
                  <Scanner
                    onScan={(results) => handleQRScanResult(results)}
                    onError={(error) => {
                      console.error('QR scan error:', error)
                    }}
                    constraints={{
                      facingMode: 'environment',
                      width: { ideal: 1920 },
                      height: { ideal: 1080 },
                      advanced: [
                        { focusMode: 'continuous' },
                        { zoom: { min: 1, max: 5 } },
                      ],
                    } as MediaTrackConstraints & { advanced?: Array<Record<string, unknown>> }}
                    components={{
                      zoom: true,
                    }}
                  />
                )}
              </div>
              
              {/* Show current scan feedback */}
              {scannedCode && (
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-muted-foreground">
                    Scanned: <span className="font-medium text-foreground">{scannedCode}</span>
                  </span>
                </div>
              )}

              {/* Show scanned codes list in multi-scan mode */}
              {multiScan && uniqueDisplayCodes.total > 0 && (
                <div className="mt-4 w-full">
                  <p className="text-sm font-medium mb-2">
                    Scanned ({uniqueDisplayCodes.total}):
                  </p>
                  <ScrollArea className="h-32 w-full rounded-md border p-2">
                    <div className="flex flex-wrap gap-2">
                      {/* Show existing codes first (unique) - with remove button */}
                      {uniqueDisplayCodes.existing.map((code, index) => (
                        <Badge 
                          key={`existing-${code}-${index}`} 
                          variant="outline" 
                          className="text-xs pr-1 flex items-center gap-1"
                        >
                          {code}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveCode(code)
                            }}
                            className="ml-1 rounded-full hover:bg-muted p-0.5 transition-colors"
                            aria-label={`Remove ${code}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {/* Show newly scanned codes (unique, excluding existing) - with remove button */}
                      {uniqueDisplayCodes.new.map((code, index) => (
                        <Badge 
                          key={`new-${code}-${index}`} 
                          variant="secondary" 
                          className="text-xs pr-1 flex items-center gap-1"
                        >
                          {code}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveCode(code)
                            }}
                            className="ml-1 rounded-full hover:bg-secondary-foreground/20 p-0.5 transition-colors"
                            aria-label={`Remove ${code}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* Upload Mode */}
          {qrMode === 'upload' && (
            <div className="flex flex-col items-center justify-center py-4">
              <div id="qr-reader" className="w-full min-h-[200px]"></div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleQRUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose Image
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {multiScan ? 'Done' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

