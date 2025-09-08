# Production Authentication Troubleshooting

## Issue: Authentication doesn't persist after Google OAuth redirect

This guide helps debug authentication issues on https://creatortoolhub.com

## Quick Checklist

1. **Google OAuth Configuration**
   - ✅ Redirect URI: `https://creatortoolhub.com/api/auth/callback` (no `/google` suffix)
   - ✅ Google+ API enabled in Google Cloud Console
   - ✅ OAuth consent screen configured

2. **Cloudflare Environment Variables**
   Check these are set in Cloudflare Pages → Settings → Environment variables:
   ```
   NEXTAUTH_SECRET=your-secret-here
   NEXTAUTH_URL=https://creatortoolhub.com
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

3. **Domain Configuration**
   - ✅ Custom domain properly configured in Cloudflare Pages
   - ✅ SSL certificate active
   - ✅ No redirect loops between www/non-www

## Debugging Steps

### Step 1: Check Browser Console
1. Open https://creatortoolhub.com
2. Open browser DevTools → Console
3. Click "Sign in with Google"
4. Look for these logs after redirect:
   ```
   All cookies: [should show auth-token if working]
   Auth token: [should show token value]
   Token payload: [should show user data]
   User authenticated: [should show email]
   ```

### Step 2: Check Network Tab
1. Open DevTools → Network tab
2. Click "Sign in with Google"
3. Look for:
   - Redirect to Google OAuth (should have correct client_id and redirect_uri)
   - Callback to `/api/auth/callback` (should set Set-Cookie header)
   - Final redirect to home page

### Step 3: Check Cloudflare Function Logs
1. Go to Cloudflare Dashboard → Pages → Your project
2. Click "Functions" tab
3. Look for logs from `/api/auth/*` functions
4. Check for these log entries:
   ```
   Auth request: { pathname, code, state, url }
   Processing OAuth callback with code: ...
   Token exchange result: { hasAccessToken: true }
   User info retrieved: { email, name }
   Setting auth cookie and redirecting: { isProduction: true, ... }
   ```

### Step 4: Test OAuth Flow Manually
Test the OAuth URLs directly:

1. **Sign-in URL**: https://creatortoolhub.com/api/auth/signin
   - Should redirect to Google OAuth
   - Check the redirect_uri parameter matches exactly

2. **After Google auth**, you'll be redirected to:
   - https://creatortoolhub.com/api/auth/callback?code=...&state=signin
   - This should set the auth cookie and redirect to home

## Common Issues & Fixes

### Issue: "OAuth configuration error"
**Cause**: Missing GOOGLE_CLIENT_ID in Cloudflare environment variables
**Fix**: Add the environment variable in Cloudflare Pages settings

### Issue: Google shows "redirect_uri_mismatch"
**Cause**: Redirect URI in Google OAuth doesn't match exactly
**Fix**: Update Google OAuth settings to use `https://creatortoolhub.com/api/auth/callback`

### Issue: Cookie not being set
**Cause**: Usually environment variable issues
**Fix**: 
1. Verify NEXTAUTH_URL=https://creatortoolhub.com (no trailing slash)
2. Verify NEXTAUTH_SECRET is set
3. Check Cloudflare function logs for errors

### Issue: Cookie set but not persisting
**Cause**: Domain or security issues
**Fix**: 
1. Ensure you're accessing via https://creatortoolhub.com (not a different subdomain)
2. Check browser security settings aren't blocking cookies
3. Verify the cookie domain in DevTools → Application → Cookies

### Issue: Token expired immediately
**Cause**: Server time issues or token generation problems
**Fix**: Check the token payload in browser console for correct expiration time

## Environment Variable Template

For Cloudflare Pages, set these exactly:

```bash
# Required - no trailing slashes
NEXTAUTH_URL=https://creatortoolhub.com
NEXTAUTH_SECRET=your-32-char-secret-from-openssl-rand-base64-32

# Google OAuth - from Google Cloud Console
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional - for thumbnail generation
GEMINI_API_KEY=your-gemini-api-key
```

## Testing Locally vs Production

The authentication flow works differently:

**Local (http://localhost:3000)**:
- Cookies don't use Secure flag
- NEXTAUTH_URL=http://localhost:3000
- Redirect URI: http://localhost:3000/api/auth/callback

**Production (https://creatortoolhub.com)**:
- Cookies use Secure flag (HTTPS only)
- NEXTAUTH_URL=https://creatortoolhub.com
- Redirect URI: https://creatortoolhub.com/api/auth/callback

Make sure your Google OAuth app has BOTH redirect URIs configured if testing both environments.
