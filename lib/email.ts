import { Resend } from 'resend'

// Initialize Resend client (only if API key is available)
let resend: Resend | null = null

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY)
} else {
  console.warn('RESEND_API_KEY is not configured. Email functionality will be disabled.')
}

/**
 * Send welcome email with password to newly created user
 */
export async function sendWelcomeEmail(
  email: string,
  password: string,
  role: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY || !resend) {
      const errorMsg = 'Email service not configured. Please set RESEND_API_KEY environment variable.'
      console.error('[EMAIL]', errorMsg)
      return { success: false, error: errorMsg }
    }

    // Use verified domain email or fallback to default
    // IMPORTANT: To send emails to any recipient, you must:
    // 1. Verify a domain at https://resend.com/domains
    // 2. Set RESEND_FROM_EMAIL to an email using that verified domain (e.g., noreply@yourdomain.com)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Asset Dog'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const emailPayload = {
      from: fromEmail,
      to: email,
      subject: `Welcome to ${siteName} - Your Account Credentials`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to ${siteName}</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #2563eb; margin-top: 0;">Welcome to ${siteName}!</h1>
              
              <p>Your account has been created successfully. Below are your login credentials:</p>
              
              <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 0 0 10px 0;"><strong>Password:</strong> <code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</code></p>
                <p style="margin: 10px 0 0 0;"><strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
              </div>
              
              <p style="color: #dc2626; font-weight: bold;">⚠️ Important: Please change your password after your first login for security purposes.</p>
              
              <div style="margin: 30px 0;">
                <a href="${siteUrl}/login" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Your Account</a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                If you did not request this account, please contact your administrator immediately.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
Welcome to ${siteName}!

Your account has been created successfully. Below are your login credentials:

Email: ${email}
Password: ${password}
Role: ${role.charAt(0).toUpperCase() + role.slice(1)}

⚠️ Important: Please change your password after your first login for security purposes.

Login to your account: ${siteUrl}/login

If you did not request this account, please contact your administrator immediately.
      `,
    }

    const result = await resend.emails.send(emailPayload)

    if (result.error) {
      // Provide more helpful error messages for common issues
      let errorMessage = result.error.message || 'Failed to send email'
      
      if (result.error.message?.includes('only send testing emails')) {
        errorMessage = 'Email service is in testing mode. To send emails to any recipient, please verify a domain at resend.com/domains and set RESEND_FROM_EMAIL environment variable to use that domain.'
      } else if (result.error.message?.includes('domain') || result.error.message?.includes('verify')) {
        errorMessage = 'Email domain not verified. Please verify your domain at resend.com/domains and update RESEND_FROM_EMAIL.'
      }
      
      console.error('[EMAIL] Failed to send welcome email:', errorMessage)
      return { success: false, error: errorMessage }
    }

    return { success: true }
  } catch (error) {
    console.error('Error sending welcome email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
  }
}

/**
 * Send password reset email with reset link
 * Used as fallback when Supabase email sending fails
 */
export async function sendPasswordResetEmail(
  email: string,
  resetLink: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY || !resend) {
      const errorMsg = 'Email service not configured. Please set RESEND_API_KEY environment variable.'
      console.error('[EMAIL]', errorMsg)
      return { success: false, error: errorMsg }
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Asset Dog'

    const emailPayload = {
      from: fromEmail,
      to: email,
      subject: `Reset Your Password - ${siteName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password - ${siteName}</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #2563eb; margin-top: 0;">Reset Your Password</h1>
              
              <p>We received a request to reset your password for your ${siteName} account. Click the button below to create a new password:</p>
              
              <div style="margin: 30px 0; text-align: center;">
                <a href="${resetLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                If you didn't request a password reset, please ignore this email or contact your administrator.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
Reset Your Password - ${siteName}

We received a request to reset your password for your ${siteName} account. 
Follow the link below to create a new password:

${resetLink}

If you didn't request a password reset, please ignore this email or contact your administrator.
      `,
    }

    const result = await resend.emails.send(emailPayload)

    if (result.error) {
      let errorMessage = result.error.message || 'Failed to send email'
      
      if (result.error.message?.includes('only send testing emails')) {
        errorMessage = 'Email service is in testing mode. To send emails to any recipient, please verify a domain at resend.com/domains and set RESEND_FROM_EMAIL environment variable to use that domain.'
      }
      
      console.error('[EMAIL] Failed to send password reset email:', errorMessage)
      return { success: false, error: errorMessage }
    }

    return { success: true }
  } catch (error) {
    console.error('Error sending password reset email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
  }
}

