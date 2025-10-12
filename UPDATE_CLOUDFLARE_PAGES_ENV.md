# Update Cloudflare Pages Environment Variables

## Issue
The old Autumn API key is still being used in production because Cloudflare Pages has the old environment variables cached.

## Solution

### 1. Update Cloudflare Pages Environment Variables

1. **Go to Cloudflare Dashboard:**
   - URL: https://dash.cloudflare.com/

2. **Navigate to Pages Settings:**
   - Click on **Pages** in the left sidebar
   - Select your project: **creatortoolhub** (or **creator-tool-hub**)
   - Click on **Settings** tab
   - Click on **Environment variables**

3. **Update the following variables:**

   **For Production environment:**
   
   | Variable Name | New Value |
   |--------------|-----------|
   | `AUTUMN_SECRET_KEY` | `am_sk_live_LsfzJP38oGlliG51u3yLCAXC0WtJyQH8a89kCqAS5n` |
   | `GEMINI_API_KEY` | `AIzaSyB-Nx6r7RvC1i1pqRXr8Wub0AE2RSeCnPM` |

4. **Click Save**

5. **Trigger a Redeploy:**
   - Option A: Go to **Deployments** tab and click **Retry deployment** on the latest deployment
   - Option B: Push a new commit to trigger automatic deployment
   - Option C: Use the Cloudflare Pages API or CLI

### 2. Verify the Update

After redeployment, test the production site:

```bash
# Test that the worker is using new keys
curl -X POST https://creatortoolhub.com/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}' \
  -v
```

You should NOT see the old key error anymore.

### 3. Local Development

Your local dev servers were killed. Restart them:

```bash
npm run dev
```

This will pick up the new keys from `.env.local`.

## Summary

✅ **Cloudflare Worker** - Keys updated via `wrangler secret put` (DONE)
✅ **Local .env files** - Updated with new keys (DONE)
⚠️ **Cloudflare Pages** - Need to update via dashboard (DO THIS NOW)
✅ **Local dev servers** - Killed, restart with `npm run dev` (DO THIS AFTER)

## Notes

- Cloudflare Pages environment variables are separate from Worker secrets
- Pages uses these env vars for the Next.js frontend build and runtime
- Worker uses secrets set via `wrangler secret put`
- Both need to be updated for full key rotation

