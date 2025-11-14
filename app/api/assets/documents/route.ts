import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'

const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf', '.jpg', '.jpeg', '.png', '.gif', '.webp']

// Simple in-memory cache for file listings (cleared on server restart)
// Cache expires after 5 minutes
interface CacheEntry {
  files: Array<{
    name: string
    id: string
    created_at: string
    bucket: string
    path: string
  }>
  timestamp: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Declare global type for cache
declare global {
  var documentFilesCache: CacheEntry | undefined
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication (required for viewing)
    const auth = await verifyAuth()
    if (auth.error || !auth.user) {
      return auth.error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Allow viewing documents without canManageMedia permission
    // Users can view but actions (upload/delete) are controlled by client-side checks

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)

    const supabaseAdmin = createAdminSupabaseClient()

    // Helper function to recursively list all files in a folder
    const listAllFiles = async (bucket: string, folder: string = ''): Promise<Array<{
      name: string
      id: string
      created_at: string
      path: string
      metadata?: {
        size?: number
        mimetype?: string
      }
    }>> => {
      const allFiles: Array<{
        name: string
        id: string
        created_at: string
        path: string
        metadata?: {
          size?: number
          mimetype?: string
        }
      }> = []

      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(folder, {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' },
        })

      if (error) {
        return allFiles
      }

      if (!data) return allFiles

      for (const item of data) {
        const itemPath = folder ? `${folder}/${item.name}` : item.name
        const lastDotIndex = item.name.lastIndexOf('.')
        const ext = lastDotIndex > 0 
          ? item.name.toLowerCase().substring(lastDotIndex)
          : ''
        
        // Check if it's a folder by checking if id is missing
        const isFolder = item.id === null || item.id === undefined
        
        if (isFolder) {
          // It's a folder, recursively list files inside
          const subFiles = await listAllFiles(bucket, itemPath)
          allFiles.push(...subFiles)
        } else {
          // Include all files (filtering by folder path happens later)
          // This ensures we get all files from the assets_documents folder
          allFiles.push({
            name: item.name,
            id: item.id || itemPath,
            created_at: item.created_at || new Date().toISOString(),
            path: itemPath,
            metadata: item.metadata ? {
              size: item.metadata.size,
              mimetype: item.metadata.mimetype,
            } : undefined,
          })
        }
      }

      return allFiles
    }

    // Check cache first
    let allFiles: Array<{
      name: string
      id: string
      created_at: string
      bucket: string
      path: string
      metadata?: {
        size?: number
        mimetype?: string
      }
    }> = []
    
    const cached = globalThis.documentFilesCache
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // Use cached file list
      allFiles = cached.files
    } else {
      // Fetch fresh file list
      // List files from assets_documents folder in assets bucket
      const assetsFiles = await listAllFiles('assets', 'assets_documents')

      // List files from assets_documents folder in file-history bucket
      const fileHistoryFiles = await listAllFiles('file-history', 'assets/assets_documents')

      // Combine files from both buckets
      const combinedFiles: Array<{
        name: string
        id: string
        created_at: string
        bucket: string
        path: string
        metadata?: {
          size?: number
          mimetype?: string
        }
      }> = []

      // Add files from assets bucket (only from assets_documents folder)
      // Filter by path to ensure we only get documents, not images from assets_images
      assetsFiles.forEach((file) => {
        // Ensure file is in assets_documents folder and NOT in assets_images folder
        if (file.path.startsWith('assets_documents/') && !file.path.startsWith('assets_images/')) {
          combinedFiles.push({
            ...file,
            bucket: 'assets',
            path: file.path,
            metadata: file.metadata,
          })
        }
      })

      // Add files from file-history bucket (only from assets/assets_documents folder)
      // Filter by path to ensure we only get documents, not images from assets_images
      fileHistoryFiles.forEach((file) => {
        // Ensure file is in assets/assets_documents folder and NOT in assets/assets_images folder
        if (file.path.startsWith('assets/assets_documents/') && !file.path.startsWith('assets/assets_images/')) {
          combinedFiles.push({
            ...file,
            bucket: 'file-history',
            path: file.path,
            metadata: file.metadata,
          })
        }
      })

      // Sort by created_at descending
      combinedFiles.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateB - dateA
      })

      allFiles = combinedFiles

      // Cache the result
      globalThis.documentFilesCache = {
        files: allFiles,
        timestamp: Date.now(),
      }
    }

    // Paginate
    const totalCount = allFiles.length
    const skip = (page - 1) * pageSize
    const paginatedFiles = allFiles.slice(skip, skip + pageSize)

    // First, prepare all file data and extract URLs/assetTagIds
    const fileData = paginatedFiles.map((file) => {
      const { data: urlData } = supabaseAdmin.storage
        .from(file.bucket)
        .getPublicUrl(file.path)

      // Extract full filename and assetTagId
      const pathParts = file.path.split('/')
      const actualFileName = pathParts[pathParts.length - 1]
      
      // Extract assetTagId - filename format is: assetTagId-timestamp.ext
      const fileNameWithoutExt = actualFileName.substring(0, actualFileName.lastIndexOf('.'))
      const timestampMatch = fileNameWithoutExt.match(/-(20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$/)
      let assetTagId = timestampMatch 
        ? fileNameWithoutExt.substring(0, timestampMatch.index)
        : fileNameWithoutExt.split('-')[0] || fileNameWithoutExt
      
      // If the extracted assetTagId is "documents", it's a standalone document upload, not linked to an asset
      if (assetTagId === 'documents') {
        assetTagId = ''
      }

      const publicUrl = urlData?.publicUrl || ''

      return {
        file,
        publicUrl,
        assetTagId,
        actualFileName,
        storageSize: file.metadata?.size,
        storageMimeType: file.metadata?.mimetype,
      }
    })

    // Batch query: Get all linked documents in a single query
    const allPublicUrls = fileData.map(fd => fd.publicUrl).filter(Boolean)
    
    // Normalize URLs by removing query parameters and fragments for better matching
    const normalizeUrl = (url: string): string => {
      try {
        const urlObj = new URL(url)
        return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`
      } catch {
        // If URL parsing fails, return as-is
        return url.split('?')[0].split('#')[0]
      }
    }
    
    const normalizedPublicUrls = allPublicUrls.map(normalizeUrl)
    
    // Build OR conditions for URL and filename matching
    const urlConditions: Array<{ documentUrl: { contains: string } } | { documentUrl: { in: string[] } }> = []
    
    // Add exact URL matches (both original and normalized)
    if (allPublicUrls.length > 0) {
      urlConditions.push({ documentUrl: { in: allPublicUrls } })
    }
    if (normalizedPublicUrls.length > 0) {
      urlConditions.push({ documentUrl: { in: normalizedPublicUrls } })
    }
    
    // Add filename-based matches (more flexible - matches if URL contains the filename)
    fileData.forEach(fd => {
      if (fd.actualFileName) {
        urlConditions.push({ documentUrl: { contains: fd.actualFileName } })
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allLinkedDocuments = await (prisma as any).assetsDocument.findMany({
      where: {
        OR: urlConditions.length > 0 ? urlConditions : [{ documentUrl: { in: [] } }], // Empty condition if no URLs
      },
      select: {
        assetTagId: true,
        documentUrl: true,
        documentType: true,
        documentSize: true,
        fileName: true,
        mimeType: true,
      },
    })

    // Create a map for quick lookup: documentUrl -> assetTagIds and document metadata
    const documentUrlToAssetTagIds = new Map<string, Set<string>>()
    const assetTagIdToDocumentUrls = new Map<string, Set<string>>()
    const documentUrlToMetadata = new Map<string, { documentType: string | null; documentSize: number | null; fileName: string | null; mimeType: string | null }>()
    
    allLinkedDocuments.forEach((doc: { assetTagId: string; documentUrl: string; documentType: string | null; documentSize: number | null; fileName: string | null; mimeType: string | null }) => {
      if (!doc.assetTagId || !doc.documentUrl) return
      
      // Store metadata
      documentUrlToMetadata.set(doc.documentUrl, {
        documentType: doc.documentType || null,
        documentSize: doc.documentSize || null,
        fileName: doc.fileName || null,
        mimeType: doc.mimeType || null,
      })
      
      // Map by documentUrl
      if (!documentUrlToAssetTagIds.has(doc.documentUrl)) {
        documentUrlToAssetTagIds.set(doc.documentUrl, new Set())
      }
      documentUrlToAssetTagIds.get(doc.documentUrl)!.add(doc.assetTagId)
      
      // Map by assetTagId (for filename matching)
      if (!assetTagIdToDocumentUrls.has(doc.assetTagId)) {
        assetTagIdToDocumentUrls.set(doc.assetTagId, new Set())
      }
      assetTagIdToDocumentUrls.get(doc.assetTagId)!.add(doc.documentUrl)
    })

    // Also check for filename matches in documentUrl
    fileData.forEach(({ publicUrl, assetTagId, actualFileName }) => {
      if (!assetTagId) return
      
      const matchingUrls = Array.from(assetTagIdToDocumentUrls.get(assetTagId) || [])
        .filter(url => url.includes(actualFileName))
      
      matchingUrls.forEach(url => {
        if (!documentUrlToAssetTagIds.has(url)) {
          documentUrlToAssetTagIds.set(url, new Set())
        }
        documentUrlToAssetTagIds.get(url)!.add(assetTagId)
      })
    })

    // Get all unique asset tag IDs that are linked
    const allLinkedAssetTagIds = new Set<string>()
    fileData.forEach(({ publicUrl }) => {
      const tagIds = documentUrlToAssetTagIds.get(publicUrl)
      if (tagIds) {
        tagIds.forEach(id => allLinkedAssetTagIds.add(id))
      }
    })

    // Batch query: Get all asset deletion status in a single query
    const linkedAssetsInfoMap = new Map<string, boolean>()
    if (allLinkedAssetTagIds.size > 0) {
      const assets = await prisma.assets.findMany({
        where: {
          assetTagId: { in: Array.from(allLinkedAssetTagIds) },
        },
        select: {
          assetTagId: true,
          isDeleted: true,
        }
      })

      assets.forEach(asset => {
        linkedAssetsInfoMap.set(asset.assetTagId, asset.isDeleted || false)
      })
    }

    // Calculate total storage used from ALL files (not just paginated)
    // Filter to only include files from assets_documents folder
    const documentsFiles = allFiles.filter(file => 
      file.path.startsWith('assets_documents/') || file.path.startsWith('assets/assets_documents/')
    )
    const allFileData = documentsFiles.map((file) => {
      const { data: urlData } = supabaseAdmin.storage
        .from(file.bucket)
        .getPublicUrl(file.path)

      const pathParts = file.path.split('/')
      const actualFileName = pathParts[pathParts.length - 1]
      const fileNameWithoutExt = actualFileName.substring(0, actualFileName.lastIndexOf('.'))
      const timestampMatch = fileNameWithoutExt.match(/-(20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$/)
      const assetTagId = timestampMatch 
        ? fileNameWithoutExt.substring(0, timestampMatch.index)
        : fileNameWithoutExt.split('-')[0] || fileNameWithoutExt

      const publicUrl = urlData?.publicUrl || ''

      return {
        file,
        publicUrl,
        storageSize: file.metadata?.size,
        storageMimeType: file.metadata?.mimetype,
      }
    })

    // Get metadata for all files from database
    const allFilePublicUrls = allFileData.map(fd => fd.publicUrl).filter(Boolean)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDbDocuments = await (prisma as any).assetsDocument.findMany({
      where: {
        documentUrl: { in: allFilePublicUrls },
      },
      select: {
        documentUrl: true,
        documentType: true,
        documentSize: true,
        fileName: true,
        mimeType: true,
      },
    })

    const allDocumentUrlToMetadata = new Map<string, { documentType: string | null; documentSize: number | null; fileName: string | null; mimeType: string | null }>()
    allDbDocuments.forEach((doc: { documentUrl: string; documentType: string | null; documentSize: number | null; fileName: string | null; mimeType: string | null }) => {
      if (doc.documentUrl) {
        allDocumentUrlToMetadata.set(doc.documentUrl, {
          documentType: doc.documentType || null,
          documentSize: doc.documentSize || null,
          fileName: doc.fileName || null,
          mimeType: doc.mimeType || null,
        })
      }
    })

    // Calculate total storage used from all files
    const totalStorageUsed = allFileData.reduce((sum, { publicUrl, storageSize }) => {
      const dbMetadata = allDocumentUrlToMetadata.get(publicUrl) || { documentType: null, documentSize: null, fileName: null, mimeType: null }
      const documentSize = storageSize || dbMetadata.documentSize || null
      return sum + (documentSize || 0)
    }, 0)

    // Build the response (only for paginated documents)
    const documents = fileData.map(({ file, publicUrl, assetTagId, actualFileName, storageSize, storageMimeType }) => {
      // Find matching database documentUrl(s) for this publicUrl
      // Check both exact match and normalized match
      const normalizedPublicUrl = normalizeUrl(publicUrl)
      let matchingDbDocumentUrl: string | null = null
      
      // Find the database documentUrl that matches this publicUrl
      for (const [dbDocumentUrl] of documentUrlToAssetTagIds.keys()) {
        const normalizedDbUrl = normalizeUrl(dbDocumentUrl)
        if (dbDocumentUrl === publicUrl || normalizedDbUrl === normalizedPublicUrl) {
          matchingDbDocumentUrl = dbDocumentUrl
          break
        }
      }
      
      // Also check by filename if no exact match found
      if (!matchingDbDocumentUrl && actualFileName) {
        for (const [dbDocumentUrl] of documentUrlToAssetTagIds.keys()) {
          if (dbDocumentUrl.toLowerCase().includes(actualFileName.toLowerCase())) {
            matchingDbDocumentUrl = dbDocumentUrl
            break
          }
        }
      }
      
      // Use database documentUrl if found, otherwise use storage publicUrl
      const finalDocumentUrl = matchingDbDocumentUrl || publicUrl
      
      // Get linked asset tag IDs using the final documentUrl (database URL takes precedence)
      const linkedAssetTagIds = Array.from(documentUrlToAssetTagIds.get(finalDocumentUrl) || documentUrlToAssetTagIds.get(publicUrl) || [])
      const linkedAssetsInfo = linkedAssetTagIds.map(tagId => ({
        assetTagId: tagId,
        isDeleted: linkedAssetsInfoMap.get(tagId) || false,
      }))
      const hasDeletedAsset = linkedAssetsInfo.some(info => info.isDeleted)
      
      // Get metadata - prefer database metadata if using database URL
      const dbMetadata = documentUrlToMetadata.get(finalDocumentUrl) || documentUrlToMetadata.get(publicUrl) || { documentType: null, documentSize: null, fileName: null, mimeType: null }

      // Prefer storage metadata over database metadata (storage is source of truth)
      // Fallback to database metadata if storage metadata is not available
      const documentType = dbMetadata.documentType || null
      const documentSize = storageSize || dbMetadata.documentSize || null
      const fileName = dbMetadata.fileName || actualFileName
      const mimeType = storageMimeType || dbMetadata.mimeType || null

      return {
        id: file.id || file.path,
        documentUrl: finalDocumentUrl, // Use database documentUrl if available, otherwise storage publicUrl
        assetTagId,
        fileName: fileName,
        createdAt: file.created_at || new Date().toISOString(),
        isLinked: linkedAssetTagIds.length > 0,
        linkedAssetTagId: linkedAssetTagIds[0] || null, // Keep first one for backward compatibility
        linkedAssetTagIds: linkedAssetTagIds, // Array of all linked asset tag IDs
        linkedAssetsInfo: linkedAssetsInfo, // Array with deletion status for each
        assetIsDeleted: hasDeletedAsset,
        documentType: documentType,
        documentSize: documentSize,
        mimeType: mimeType,
      }
    })

    return NextResponse.json({
      documents,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
      storage: {
        used: totalStorageUsed,
        limit: 5 * 1024 * 1024, // 5MB limit (temporary)
      },
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

