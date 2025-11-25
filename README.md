# Creator Tool Hub

A single Next.js app that hosts multiple creator tools. The first tool is the Thumbnail Creator at `/thumbnails`.


## Environment Configuration

All required environment variables have been configured for production deployment.

## Tech
- Next.js 15 (App Router)
- React 19, TypeScript
- Tailwind (via `@tailwindcss/postcss`), autoprefixer, `tailwindcss-animate`
- NextAuth (Auth.js) with Google OAuth
- API uses Google Gemini via `@google/genai`

## Getting started

1) Install deps

```bash
npm install
```

2) Env vars

**For Development (Simplified Setup):**

Create `.env.local` with the required API keys:

```bash
# Required for development
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Fal AI Configuration (for image editing features)
FAL_KEY=your_fal_api_key_here
FAL_MODEL_PRIMARY=fal-ai/alpha-image-232/edit-image
FAL_MODEL_SECONDARY=fal-ai/qwen-image-edit/image-to-image
```

**Development Mode Features:**
- 🚫 **No Google OAuth setup required** - authentication is automatically bypassed
- 🚫 **No Autumn billing setup required** - credits are mocked (999 credits)
- ✅ **Mock user**: `dev@example.com` with full access
- ✅ **All features work** without external service dependencies

**For Production:**

Copy `.env.production.example` to your Cloudflare Pages environment variables and fill in all values:

```bash
# Required for production
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=https://your-domain.com
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
AUTUMN_SECRET_KEY=your_autumn_secret_key
NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID=credits
GEMINI_API_KEY=your_gemini_api_key_here

# Fal AI Configuration (for image editing features)
FAL_KEY=your_fal_api_key_here
FAL_MODEL_PRIMARY=fal-ai/alpha-image-232/edit-image
FAL_MODEL_SECONDARY=fal-ai/qwen-image-edit/image-to-image
```

Get Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/).
Generate NEXTAUTH_SECRET with: `openssl rand -base64 32`

3) Run dev server

```bash
npm run dev
```

Open http://localhost:3000

- Home (/) shows a minimal landing page
- Thumbnails (/thumbnails) opens the Thumbnail Creator

## API runtime

- The generation endpoint runs on the Node.js runtime for better compatibility and time/memory limits:

```ts
// app/api/generate/route.ts
export const runtime = "nodejs";
```

If you later want Edge (fast, globally distributed, but with more limits), change to `"edge"` and validate payload sizes and timeouts.

## Structure

```
app/
  page.tsx                # Landing page
  api/generate/route.ts   # Thumbnail generation (Node runtime)
  thumbnails/             # Thumbnail Creator UI
components/
lib/
public/
```

## Notes
- Minimal styling by design to keep the hub clean and focused.
- Turbopack warning suppression: `next.config.ts` sets `turbopack.root = __dirname`.
- When adding more tools, create routes like `/captions`, `/watermark`, etc., and link them from the header and landing page.

## Next steps
- Add CI and lint rules as needed
- Add e2e smoke tests for the /thumbnails workflow
- Optionally delete the old `thumbnailer/` folder if no longer needed (all logic has been moved)
