import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * POST /api/auth/reset-password
 * Reset user password using the recovery code from email
 */
export async function POST(request: NextRequest) {
  try {
    const { code, password } = await request.json()

    if (!code || !password) {
      return NextResponse.json(
        { error: 'Code and password are required' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = await createClient()

    // Handle both code and access_token formats
    // If code starts with 'pkce_', it's a token that needs to be verified with verifyOtp
    let sessionData
    let sessionError
    
    if (code.startsWith('pkce_')) {
      // This is a PKCE token - verify it using verifyOtp
      // The token needs to be hashed for verifyOtp, but Supabase's generateLink already provides the hash
      // Actually, we should use the token directly with verifyOtp
      const verifyResult = await supabase.auth.verifyOtp({
        token_hash: code,
        type: 'recovery',
      })
      sessionData = verifyResult.data
      sessionError = verifyResult.error
    } else {
      // Regular code format - exchange for session
      const result = await supabase.auth.exchangeCodeForSession(code)
      sessionData = result.data
      sessionError = result.error
    }

    if (sessionError || !sessionData?.session) {
      return NextResponse.json(
        { error: sessionError?.message || 'Invalid or expired reset code. Please request a new password reset.' },
        { status: 400 }
      )
    }

    // Now update the password using the session
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    })

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to update password' },
        { status: 400 }
      )
    }

    // Sign out the user after password reset (they need to login with new password)
    await supabase.auth.signOut()

    return NextResponse.json(
      { message: 'Password reset successfully' },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

