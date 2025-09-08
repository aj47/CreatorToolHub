# Deploy to Cloudflare Pages with NextAuth

This app runs entirely on Cloudflare Pages with NextAuth for authentication and direct Gemini API calls for thumbnail generation.

## Prerequisites
- Cloudflare account and Wrangler CLI (`npm i -g wrangler`) logged in: `wrangler login`
- Google Cloud Console project for OAuth credentials
- GitHub repo connected (for Pages autodeploys), or manual deployment

## 1) Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API (for OAuth)
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - For development: `http://localhost:3000/api/auth/callback`
   - For production: `https://creatortoolhub.com/api/auth/callback`
7. Save the Client ID and Client Secret

## 2) Environment Variables

Set these in Cloudflare Pages (Settings → Environment variables):

### Required for NextAuth:
```
NEXTAUTH_SECRET=your-random-secret-here
NEXTAUTH_URL=https://creatortoolhub.com
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Required for Gemini:
```
GEMINI_API_KEY=your-gemini-api-key
```
(or `GOOGLE_API_KEY` if you prefer)

### Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

## 3) Cloudflare Pages Setup

### Option A: GitHub Integration (Recommended)
1. Go to Cloudflare Dashboard → Pages
2. Connect to Git → Select your GitHub repo
3. Build settings:
   - Framework preset: Next.js
   - Build command: `npm run pages:build`
   - Build output directory: `.vercel/output/static`
4. Add environment variables from step 2
5. Deploy

### Option B: Manual Deployment
```bash
# Build for Cloudflare Pages
npm run pages:setup  # One-time setup
npm run pages:build

# Deploy
wrangler pages deploy .vercel/output/static --project-name=creator-tool-hub
```

## 4) Custom Domain (Optional)

1. In Cloudflare Pages → Custom domains
2. Add `creatortoolhub.com`
3. Update `NEXTAUTH_URL` environment variable to match your domain
4. Update Google OAuth redirect URIs to match your domain

## 5) Local Development

Create `.env.local`:
```
NEXTAUTH_SECRET=your-local-secret
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GEMINI_API_KEY=your-gemini-api-key
```

Run locally:
```bash
npm run dev
```

## Architecture Notes

- **Authentication**: NextAuth with Google OAuth, JWT sessions (no database)
- **Generation**: Unbound Worker handles `/api/generate` for higher CPU headroom; the rest of the app runs on Cloudflare Pages
- **Storage**: None - images returned as data URLs to client
- **Runtime**: Edge runtime for Next.js Pages functions; Unbound usage model for the Worker
- **Hosting**: Cloudflare Pages + Cloudflare Workers (routed for `/api/generate`)


## 6) Unbound Worker for generation (recommended for CPU limits)

We route `/api/generate` to a dedicated Cloudflare Worker set to the Unbound usage model. This gives the generation endpoint higher CPU/time limits, while the rest of the site stays on Pages.

Files:
- `workers/generate/wrangler.toml`
- `workers/generate/src/index.ts`

Steps:
1. Configure secrets and variables
   ```bash
   cd workers/generate
   wrangler secret put GEMINI_API_KEY   # paste your key
   # optional: wrangler kv:namespace create ... (not needed here)
   ```
2. Deploy the worker
   ```bash
   wrangler deploy
   ```
3. Route your domain path to the worker (Cloudflare Dashboard → Workers → Triggers → Routes)
   - Pattern: `creatortoolhub.com/api/generate`
   - Or use the `wrangler.toml` routes block (environment-specific).

Notes
- The Next.js route `/api/generate` remains available for local dev. In production, the route is served by the Worker based on the path rule above.
- Ensure the same environment variables (Gemini API key) are set for the Worker.

## Troubleshooting

### OAuth Issues
- Verify redirect URIs match exactly (including protocol)
- Check that Google+ API is enabled
- Ensure `NEXTAUTH_URL` matches your domain

### Generation Issues
- Verify `GEMINI_API_KEY` is set correctly
- Check Cloudflare Pages function logs for errors
- Ensure `/api/generate` uses `runtime = "edge"`

### Build Issues
- Run `npm run pages:setup` if first time deploying
- Ensure all dependencies are in `package.json`
- Check build logs in Cloudflare Pages dashboard
