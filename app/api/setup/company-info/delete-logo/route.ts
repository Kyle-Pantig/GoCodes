import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function DELETE(request: NextRequest) {
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

    // Get logo URL from query params
    const { searchParams } = new URL(request.url)
    const logoUrl = searchParams.get('logoUrl')

    if (!logoUrl) {
      return NextResponse.json(
        { error: 'Logo URL is required' },
        { status: 400 }
      )
    }

    // Delete file from Supabase storage
    try {
      const supabaseAdmin = createAdminSupabaseClient()
      
      // Extract bucket and path from URL
      // URLs are like: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
      const urlMatch = logoUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
      
      if (urlMatch) {
        const bucket = urlMatch[1]
        const path = urlMatch[2]
        
        // Delete from storage
        const { error: deleteError } = await supabaseAdmin.storage
          .from(bucket)
          .remove([path])

        if (deleteError) {
          console.error('Failed to delete logo from storage:', deleteError)
          // Continue even if storage deletion fails (file might not exist)
        }
      } else {
        console.warn('Could not extract bucket and path from logo URL:', logoUrl)
      }
    } catch (storageError) {
      console.error('Storage deletion error:', storageError)
      // Continue even if storage deletion fails
    }

    return NextResponse.json({
      success: true,
      message: 'Logo deleted from storage successfully',
    })
  } catch (error) {
    console.error('Error deleting logo:', error)
    return NextResponse.json(
      { error: 'Failed to delete logo' },
      { status: 500 }
    )
  }
}

