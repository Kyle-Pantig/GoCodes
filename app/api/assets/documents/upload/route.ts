import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { prisma } from '@/lib/prisma'

// Clear the document files cache after upload
declare global {
  var documentFilesCache: {
    files: Array<{
      name: string
      id: string
      created_at: string
      path: string
      bucket: string
    }>
    timestamp: number
  } | undefined
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const auth = await verifyAuth()
    if (auth.error || !auth.user) {
      return auth.error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check media permission
    const permissionCheck = await requirePermission('canManageMedia')
    if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

    // Get file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('documentType') as string | null // Optional: receipt, purchase_order, manual, etc.

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type - allow common document formats and images
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'application/rtf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ]
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf', '.jpg', '.jpeg', '.png', '.gif', '.webp']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, RTF, JPEG, PNG, GIF, and WebP files are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB per file)
    const maxFileSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Check storage limit (5MB total - temporary)
    const storageLimit = 5 * 1024 * 1024 // 5MB limit
    
    const supabaseAdmin = createAdminSupabaseClient()
    
    try {
      // List all files from storage to calculate total size
      const listAllFiles = async (bucket: string, folder: string = ''): Promise<Array<{
        metadata?: { size?: number }
        path: string
      }>> => {
        const allFiles: Array<{ metadata?: { size?: number }; path: string }> = []
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .list(folder, {
            limit: 1000,
          })

        if (error || !data) return allFiles

        for (const item of data) {
          const itemPath = folder ? `${folder}/${item.name}` : item.name
          const isFolder = item.id === null || item.id === undefined
          
          if (isFolder) {
            const subFiles = await listAllFiles(bucket, itemPath)
            allFiles.push(...subFiles)
          } else {
            allFiles.push({ 
              metadata: item.metadata as { size?: number } | undefined,
              path: itemPath
            })
          }
        }

        return allFiles
      }

      const assetsFiles = await listAllFiles('assets', '')
      const fileHistoryFiles = await listAllFiles('file-history', 'assets')
      
      // Calculate storage from files
      let currentStorageUsed = 0
      const allFiles = [...assetsFiles, ...fileHistoryFiles]
      
      // Get sizes from storage metadata
      allFiles.forEach((file) => {
        if (file.metadata?.size) {
          currentStorageUsed += file.metadata.size
        }
      })

      // Also check database for documents that might have size info
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbDocuments = await (prisma as any).assetsDocument.findMany({
        select: {
          documentUrl: true,
          documentSize: true,
        },
      })

      // Create a set of storage file sizes for quick lookup
      const storageSizes = new Set(allFiles.map(f => f.metadata?.size).filter((s): s is number => s !== undefined))

      // Add database sizes for documents not already counted from storage
      dbDocuments.forEach((doc: { documentUrl: string; documentSize: number | null }) => {
        if (doc.documentSize && !storageSizes.has(doc.documentSize)) {
          currentStorageUsed += doc.documentSize
        }
      })

      if (currentStorageUsed + file.size > storageLimit) {
        return NextResponse.json(
          { 
            error: `Storage limit exceeded. Current usage: ${(currentStorageUsed / (1024 * 1024)).toFixed(2)}MB / ${(storageLimit / (1024 * 1024)).toFixed(2)}MB` 
          },
          { status: 400 }
        )
      }
    } catch (error) {
      // If we can't check storage, allow upload but log warning
      console.warn('Could not check storage limit:', error)
    }

    // Generate unique file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const sanitizedExtension = fileExtension.substring(1) // Remove the dot
    // Use timestamp-based filename for standalone document uploads
    const fileName = `documents-${timestamp}.${sanitizedExtension}`
    const filePath = `assets_documents/${fileName}` // Upload to assets folder in bucket

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase storage bucket 'assets' (or 'file-history/assets' if assets bucket doesn't exist)
    let publicUrl: string | null = null
    let finalFilePath = filePath

    const { error: uploadError } = await supabaseAdmin.storage
      .from('assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      // If assets bucket doesn't exist, try file-history bucket
      if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
        const fallbackPath = filePath
        const { error: fallbackError } = await supabaseAdmin.storage
          .from('file-history')
          .upload(fallbackPath, buffer, {
            contentType: file.type,
            upsert: false,
          })

        if (fallbackError) {
          console.error('Storage upload error:', fallbackError)
          return NextResponse.json(
            { error: 'Failed to upload document to storage', details: fallbackError.message },
            { status: 500 }
          )
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
          .from('file-history')
          .getPublicUrl(fallbackPath)

        publicUrl = urlData?.publicUrl || null
        finalFilePath = fallbackPath
      } else {
        console.error('Storage upload error:', uploadError)
        return NextResponse.json(
          { error: 'Failed to upload document to storage', details: uploadError.message },
          { status: 500 }
        )
      }
    } else {
      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('assets')
        .getPublicUrl(filePath)

      publicUrl = urlData?.publicUrl || null
    }

    if (!publicUrl) {
      return NextResponse.json(
        { error: 'Failed to get public URL for uploaded document' },
        { status: 500 }
      )
    }

    // Create database record for the document
    // For standalone uploads (not linked to an asset), use "STANDALONE" as placeholder
    // This can be updated later when linking to an asset
    const assetTagId = 'STANDALONE'
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documentRecord = await (prisma as any).assetsDocument.create({
        data: {
          assetTagId: assetTagId,
          documentUrl: publicUrl,
          documentType: documentType || null,
          documentSize: file.size,
          fileName: file.name,
          mimeType: file.type,
        },
      })

      // Clear the document files cache so the new file appears immediately
      if (typeof globalThis !== 'undefined') {
        globalThis.documentFilesCache = undefined
      }

      return NextResponse.json({
        id: documentRecord.id,
        filePath: finalFilePath,
        fileName: fileName,
        fileSize: file.size,
        mimeType: file.type,
        publicUrl: publicUrl,
        documentType: documentType || null,
        assetTagId: assetTagId,
      })
    } catch (dbError) {
      console.error('Error creating document record in database:', dbError)
      // Even if database insert fails, the file is already uploaded to storage
      // Return success but log the error
      return NextResponse.json(
        { 
          error: 'Document uploaded to storage but failed to save to database',
          details: dbError instanceof Error ? dbError.message : 'Unknown error',
          filePath: finalFilePath,
          fileName: fileName,
          fileSize: file.size,
          mimeType: file.type,
          publicUrl: publicUrl,
          documentType: documentType || null,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error uploading document:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}

