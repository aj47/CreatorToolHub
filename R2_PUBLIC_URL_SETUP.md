# R2 Public URL Setup Guide

## Issue Fixed
The R2 storage service was using a placeholder domain `your-r2-domain.com` instead of the actual R2 public URL. This has been fixed with the following changes:

### Code Changes Made
1. **Added R2_PUBLIC_DOMAIN environment variable** to `workers/generate/wrangler.toml`
2. **Fixed development mode detection** to properly check `NODE_ENV`
3. **Updated getSignedUrl method** to use the configured R2 public domain
4. **Passed environment to R2StorageService** constructor

### Current Status
- ✅ Worker deployed with R2_PUBLIC_DOMAIN = `pub-9a4725557b2acbac23f3fba92d096149.r2.dev`
- ❌ R2 bucket Public Development URL is **disabled** (needs to be enabled)

## Next Steps: Enable R2 Public Development URL

### Option 1: Enable via Cloudflare Dashboard (Recommended)

1. **Go to Cloudflare Dashboard**
   - Visit: https://dash.cloudflare.com
   - Navigate to: R2 Object Storage > creator-tool-hub-user-data > Settings

2. **Enable Public Development URL**
   - Scroll to "Public Development URL" section
   - Click the **"Enable"** button
   - This will make the bucket publicly accessible at: `https://pub-9a4725557b2acbac23f3fba92d096149.r2.dev`

3. **Verify the URL**
   - The public URL should match what's configured in `R2_PUBLIC_DOMAIN`
   - Test by visiting: `https://pub-9a4725557b2acbac23f3fba92d096149.r2.dev`

### Option 2: Alternative - Use Custom Domain (Production)

If you prefer not to use the r2.dev domain:

1. **Set up a custom domain** (e.g., `cdn.creatortoolhub.com`)
2. **Update R2_PUBLIC_DOMAIN** in `workers/generate/wrangler.toml`:
   ```toml
   R2_PUBLIC_DOMAIN = "cdn.creatortoolhub.com"
   ```
3. **Redeploy the worker**: `cd workers/generate && wrangler deploy`

## Testing the Fix

After enabling the Public Development URL:

1. **Generate a new thumbnail** on https://creatortoolhub.com
2. **Check the Recent Generations** section in the dashboard
3. **Verify images load** instead of showing broken image icons

## Troubleshooting

### If images still don't load:
1. Check browser console for 404 errors
2. Verify the R2 public URL is accessible
3. Ensure the bucket has public read access enabled

### If you see CORS errors:
1. Go to R2 bucket settings > CORS Policy
2. Add a CORS rule allowing your domain

## Security Note

Enabling Public Development URL makes all objects in the bucket publicly accessible. This is appropriate for user-generated thumbnails but consider using signed URLs for sensitive content in the future.
