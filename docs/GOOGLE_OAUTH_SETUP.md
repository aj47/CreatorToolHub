# Google OAuth Setup Guide

## Issue Fixed
The main issue was that the authentication cookies were being set with the `Secure` flag, which prevents them from working on `http://localhost:3000`. This has been fixed to only use the `Secure` flag in production.

## Setting up Google OAuth Credentials

1. **Go to Google Cloud Console**
   - Visit https://console.cloud.google.com/
   - Create a new project or select an existing one

2. **Enable Google+ API**
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback` (for development)
     - `https://your-domain.com/api/auth/callback` (for production)

4. **Update .env.local**
   Replace the placeholder values in `.env.local`:
   ```bash
   GOOGLE_CLIENT_ID=your_actual_client_id_here
   GOOGLE_CLIENT_SECRET=your_actual_client_secret_here
   NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
   ```

5. **Generate NEXTAUTH_SECRET**
   Run this command to generate a secure secret:
   ```bash
   openssl rand -base64 32
   ```

## Testing the Fix

1. Start the development server: `npm run dev`
2. Open http://localhost:3000
3. Click "Sign in with Google"
4. Complete the OAuth flow
5. You should now see your email in the header and remain signed in

## Debugging

The AuthButton component now includes console logging to help debug authentication issues. Check the browser console for:
- Cookie information
- Token parsing results
- Authentication status

If you're still having issues, check:
1. That your Google OAuth credentials are correct
2. That the redirect URI matches exactly
3. Browser console for any errors
4. Network tab to see if cookies are being set properly
