import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { prisma } from '@/lib/prisma'
import { retryDbOperation } from '@/lib/db-utils'

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

    // Check permission
    const permissionCheck = await requirePermission('canManageSetup')
    if (!permissionCheck.allowed && permissionCheck.error) {
      return permissionCheck.error
    }

    // Get file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const logoType = formData.get('logoType') as string // 'primary' or 'secondary'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!logoType || !['primary', 'secondary'].includes(logoType)) {
      return NextResponse.json(
        { error: 'Logo type must be "primary" or "secondary"' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG images are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Create Supabase admin client for storage operations
    let supabaseAdmin
    try {
      supabaseAdmin = createAdminSupabaseClient()
    } catch (clientError) {
      console.error('Failed to create Supabase admin client:', clientError)
      return NextResponse.json(
        { error: 'Storage service unavailable' },
        { status: 503 }
      )
    }

    // Generate unique file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileExtension = file.name.split('.').pop() || 'png'
    const sanitizedExtension = fileExtension.toLowerCase()
    const fileName = `company-logo-${logoType}-${timestamp}.${sanitizedExtension}`
    const filePath = `company-info/${fileName}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase storage bucket 'assets' (or 'file-history' if assets bucket doesn't exist)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    let publicUrl: string | null = null
    let finalFilePath = filePath

    if (uploadError) {
      // If assets bucket doesn't exist, try file-history bucket
      if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
        const fallbackPath = `company-info/${fileName}`
        const { error: fallbackError } = await supabaseAdmin.storage
          .from('file-history')
          .upload(fallbackPath, buffer, {
            contentType: file.type,
            upsert: false,
          })

        if (fallbackError) {
          console.error('Storage upload error:', fallbackError)
          return NextResponse.json(
            { error: 'Failed to upload logo to storage', details: fallbackError.message },
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
          { error: 'Failed to upload logo to storage', details: uploadError.message },
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
        { error: 'Failed to get public URL for uploaded logo' },
        { status: 500 }
      )
    }

    // Update company info with logo URL
    const existing = await retryDbOperation(() =>
      prisma.companyInfo.findFirst()
    )

    if (existing) {
      await retryDbOperation(() =>
        prisma.companyInfo.update({
          where: { id: existing.id },
          data: {
            [logoType === 'primary' ? 'primaryLogoUrl' : 'secondaryLogoUrl']: publicUrl,
          },
        })
      )
    } else {
      // Create company info record if it doesn't exist
      await retryDbOperation(() =>
        prisma.companyInfo.create({
          data: {
            companyName: 'Company Name', // Default, will be updated later
            [logoType === 'primary' ? 'primaryLogoUrl' : 'secondaryLogoUrl']: publicUrl,
          },
        })
      )
    }

    return NextResponse.json({
      success: true,
      logoUrl: publicUrl,
      logoType,
    })
  } catch (error) {
    console.error('Error uploading logo:', error)
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    )
  }
}

