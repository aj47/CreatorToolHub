# Production Readiness Report: R2 File Proxy & Dashboard

## Summary

This PR implements a file proxy endpoint in the Cloudflare Worker to serve preview images from R2 storage, enabling the generation dashboard to display thumbnails. The implementation works in local development but requires configuration adjustments for production.

**Latest Update**: Generation history has been removed from the thumbnails page and is now exclusive to the dashboard at `/dashboard`.

## Changes Made

### 1. Worker File Proxy Endpoint
- **File**: `workers/generate/src/index.ts`
- **Change**: Added `GET /api/files/<encoded-key>` route that streams files from R2
- **Status**: ✅ Working in dev, needs production base URL

### 2. R2 Storage Service
- **File**: `workers/generate/src/storage/r2.ts`
- **Change**: Updated `getSignedUrl()` to return proxy URLs instead of data URLs
  - Dev: `http://localhost:8787/api/files/{key}`
  - Prod: Placeholder `https://your-r2-domain.com/{key}` (needs replacement)
- **Status**: ⚠️ Requires production configuration

### 3. Next.js CSP Headers
- **File**: `next.config.ts`
- **Change**: Added `http://localhost:8787` to `img-src` in development
- **Status**: ✅ Works in dev, production needs worker origin

### 4. Wrangler Configuration
- **File**: `workers/generate/wrangler.toml`
- **Change**: Added D1 and R2 bindings for development environment
- **Status**: ✅ Development ready

## Production Issues to Fix

### 🔴 Critical

1. **Missing Production Base URL**
   - `getSignedUrl()` returns placeholder URL in production
   - **Fix**: Add `PUBLIC_FILE_BASE_URL` env var to Worker
   - **Options**:
     - Same-domain: `https://creatortoolhub.com`
     - Separate worker: `https://creator-tool-hub.workers.dev`

2. **Unauthenticated File Access**
   - `/api/files/*` is publicly readable
   - Keys include user ID (e.g., `users/u-123/...`), making them guessable
   - **Fix**: Implement one of:
     - A. Accept public access (simplest, if previews aren't sensitive)
     - B. Add auth check: validate `request.user` and key prefix
     - C. Implement signed tokens (best UX, more complex)

3. **Missing OPTIONS Preflight Support**
   - File route only registered for GET
   - Browser preflights may fail with 404
   - **Fix**: Register route with `['GET', 'OPTIONS']`

### 🟡 Important

4. **Duplicate CORS Headers**
   - `handleFileProxy` sets `Access-Control-Allow-Origin: '*'`
   - CORS middleware sets origin-specific headers
   - **Fix**: Remove explicit ACAO from handler, rely on middleware

5. **Stray Routes Config**
   - `wrangler.toml` has `routes = [...]` in `env.development.vars`
   - Does nothing, confuses readers
   - **Fix**: Remove from vars; add proper top-level routes if needed

6. **Route Conflicts with Next API**
   - Worker defines `/api/generate` and `/api/user/*`
   - Next app also has `/api/*` endpoints
   - **Fix**: Choose routing model:
     - A. Separate domain (CORS-based)
     - B. Same-domain with non-overlapping paths (e.g., `/api/worker/*`)

## Recommended Fixes (Minimal)

```typescript
// workers/generate/src/storage/r2.ts
async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const base =
    (this.env?.NODE_ENV === 'development' || !this.env?.NODE_ENV)
      ? 'http://localhost:8787'
      : (this.env?.PUBLIC_FILE_BASE_URL || '');
  
  return `${base}/api/files/${encodeURIComponent(key)}`;
}
```

```typescript
// workers/generate/src/index.ts
middlewareStack.route(/^\/api\/files\//, createRouteHandler(async (req, env) => {
  return await handleFileProxy(req, env);
}), ['GET', 'OPTIONS']); // Include OPTIONS for CORS preflight

// In handleFileProxy, remove explicit ACAO header
return new Response(arrayBuffer, {
  status: 200,
  headers: {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=3600',
  }
});
```

```typescript
// next.config.ts
const imgSrc = ["'self'", 'data:', 'https:', 'blob:'];
if (workerOrigin) imgSrc.push(workerOrigin);
if (process.env.NODE_ENV !== 'production') imgSrc.push('http://localhost:8787');
```

## Testing Checklist

- [x] Dashboard loads in local dev
- [x] Preview images display correctly
- [x] Generation details modal works
- [ ] Production env vars configured
- [ ] Auth/access control implemented
- [ ] OPTIONS preflight works
- [ ] No route conflicts with Next API

## Deployment Steps

1. Set `PUBLIC_FILE_BASE_URL` in Cloudflare Pages environment
2. Implement auth check in `handleFileProxy` if needed
3. Apply minimal fixes above
4. Test in staging
5. Deploy to production

## Notes

- Autumn billing 404s in dev console are harmless (development mode)
- CSP `'unsafe-eval'` in script-src should be tightened in future
- Consider implementing signed URLs for better security/UX

