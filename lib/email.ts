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
    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'GoCodes'
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
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #242424; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
            <div style="background-color: #fafafa; padding: 40px; border-radius: 8px; border: 1px solid #e8e8e8;">
              <h1 style="color: #4a9b6e; margin-top: 0; margin-bottom: 20px; font-size: 28px; font-weight: 600;">Welcome to ${siteName}!</h1>
              
              <p style="color: #242424; margin-bottom: 24px;">Your account has been created successfully. Below are your login credentials:</p>
              
              <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-left: 4px solid #4a9b6e; border-radius: 6px; padding: 24px; margin: 24px 0;">
                <p style="margin: 0 0 12px 0; color: #242424;"><strong style="color: #4a9b6e;">Email:</strong> ${email}</p>
                <p style="margin: 0 0 12px 0; color: #242424;"><strong style="color: #4a9b6e;">Password:</strong> <code style="background-color: #f5f5f5; color: #242424; padding: 4px 8px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 14px; border: 1px solid #e0e0e0;">${password}</code></p>
                <p style="margin: 12px 0 0 0; color: #242424;"><strong style="color: #4a9b6e;">Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
              </div>
              
              <div style="background-color: #fff4e6; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 24px 0;">
                <p style="color: #92400e; font-weight: 600; margin: 0;">⚠️ Important: Please change your password after your first login for security purposes.</p>
              </div>
              
              <div style="margin: 32px 0; text-align: center;">
                <a href="${siteUrl}/login?redirect=/settings/password" style="display: inline-block; background-color: #4a9b6e; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">Login to Your Account</a>
              </div>
              
              <p style="color: #6b7280; font-size: 13px; margin-top: 32px; border-top: 1px solid #e0e0e0; padding-top: 20px; line-height: 1.5;">
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

Login to your account: ${siteUrl}/login?redirect=/settings/password

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

