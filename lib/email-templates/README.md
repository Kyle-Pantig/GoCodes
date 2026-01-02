# Email Templates for GoCodes

This directory contains email templates that can be used with Supabase email customization.

## Password Reset Email

### HTML Template
- **File:** `password-reset.html`
- **Usage:** Copy the contents and paste into Supabase Dashboard → Authentication → Email Templates → Reset Password

### Plain Text Template
- **File:** `password-reset-plain.txt`
- **Usage:** Copy the contents and paste into Supabase Dashboard → Authentication → Email Templates → Reset Password (Plain Text)

## How to Apply Templates in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Select **Reset Password** template
4. Replace the HTML content with the contents from `password-reset.html`
5. Replace the Plain Text content with the contents from `password-reset-plain.txt`
6. Click **Save**

## Template Variables

Supabase provides the following variables that are automatically replaced:
- `{{ .ConfirmationURL }}` - The password reset link
- `{{ .Email }}` - User's email address
- `{{ .Token }}` - The reset token (usually not needed)
- `{{ .TokenHash }}` - Hashed token (usually not needed)
- `{{ .SiteURL }}` - Your site URL

## Customization

The templates use GoCodes branding with:
- Primary color: #2563eb (blue)
- Clean, modern design
- Responsive layout
- Security notices
- Professional styling

You can customize colors, fonts, and content as needed while maintaining the structure.

