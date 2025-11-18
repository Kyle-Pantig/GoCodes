import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/users/[id]/send-password-reset
 * Send password reset email to user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Only users with canManageUsers permission can send password reset emails
  const permissionCheck = await requirePermission('canManageUsers')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params

    // Get user from database
    const user = await prisma.assetUser.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get user email from Supabase Auth
    const supabaseAdmin = createAdminSupabaseClient()
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(user.userId)

    if (authError || !authUser?.user?.email) {
      return NextResponse.json(
        { error: 'Failed to retrieve user email' },
        { status: 400 }
      )
    }

    const userEmail = authUser.user.email

    // Use the regular Supabase client to send password reset email
    // resetPasswordForEmail definitely sends the email (unlike generateLink which just generates the link)
    // We need to create a regular client (not admin) to use resetPasswordForEmail
    const { createClient } = await import('@/lib/supabase-server')
    const supabase = await createClient()
    
    // Construct the redirect URL for password reset
    // Use localhost for development, or NEXT_PUBLIC_SITE_URL for production
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    (process.env.NEXT_PUBLIC_SUPABASE_URL ? 
                      process.env.NEXT_PUBLIC_SUPABASE_URL.replace('/rest/v1', '') : 
                      'http://localhost:3000')
    const redirectTo = `${baseUrl}/reset-password`
    
    // Send password reset email via Supabase
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo,
    })

    if (resetError) {
      return NextResponse.json(
        { 
          error: resetError.message || 'Failed to send password reset email',
          details: 'Please check Supabase email configuration. Ensure email sending is enabled and not restricted to specific domains.',
        },
        { status: 400 }
      )
    }

    // Password reset email has been sent successfully
    return NextResponse.json(
      { 
        message: 'Password reset email sent successfully',
        email: authUser.user.email,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed to send password reset email' },
      { status: 500 }
    )
  }
}

