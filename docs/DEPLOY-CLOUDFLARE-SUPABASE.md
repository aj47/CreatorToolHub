# Deploy to Cloudflare Pages with Supabase backend (async jobs)

This app runs the UI on Cloudflare Pages and offloads long-running thumbnail generation to Supabase Edge Functions.

## 0) Prerequisites
- Cloudflare account, Wrangler CLI (`npm i -g wrangler`) logged in: `wrangler login`
- Supabase project and Supabase CLI (`npm i -g supabase`) logged in: `supabase login`
- GitHub repo connected (for Pages autodeploys), or you can deploy manually.

## 1) Supabase setup

1. Create Storage bucket
```
supabase storage create-bucket thumbnails --public
```

2. Database table
```
supabase db query -f supabase/sql/jobs.sql
```

3. Deploy Edge Functions
```
# In repo root
supabase functions deploy process-generate --project-ref <PROJECT_REF>
supabase functions deploy run-job          --project-ref <PROJECT_REF>
supabase functions deploy job-status       --project-ref <PROJECT_REF>
```

4. Set function secrets (env)
```
# Must match Cloudflare Pages env SUPABASE_WEBHOOK_SECRET
supabase secrets set WEBHOOK_SECRET=<RANDOM_SHARED_SECRET> --project-ref <PROJECT_REF>

# Required for server-side supabase-js inside functions
supabase secrets set SUPABASE_URL=<https://YOUR_PROJECT.supabase.co> --project-ref <PROJECT_REF>
supabase secrets set SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>      --project-ref <PROJECT_REF>

# Gemini key (choose one)
supabase secrets set GOOGLE_API_KEY=<YOUR_GEMINI_KEY> --project-ref <PROJECT_REF>
# or
supabase secrets set GEMINI_API_KEY=<YOUR_GEMINI_KEY>  --project-ref <PROJECT_REF>
```

5. Optional: schedule the runner (recommended)
- Use an external scheduler (GitHub Actions, UptimeRobot, cron) to `POST` your run-job function every minute:
  - `https://<PROJECT>.functions.supabase.co/run-job` with header `Authorization: Bearer <WEBHOOK_SECRET>`
- Alternatively, invoke `run-job` manually from your terminal whenever needed.

## 2) Cloudflare Pages setup

1. Install Next on Pages adapter (optional for you to run locally; Pages can run it in CI via npx)
```
npm i -D @cloudflare/next-on-pages wrangler
```

2. Configure build scripts (already added)
- package.json scripts:
  - `pages:setup` – one-time setup for adapter
  - `pages:build` – builds Next to .vercel/output for Pages
  - `pages:dev` – local dev emulation

3. Create the Pages project
- In Cloudflare dashboard → Pages → Create Project → Connect GitHub → pick this repo
- Build command: `npm run pages:build`
- Output directory: `.vercel/output/static`
- Functions directory: `.vercel/output/functions`

4. Set Cloudflare Pages environment variables
- SUPABASE_ENQUEUE_URL: `https://<PROJECT>.functions.supabase.co/process-generate`
- SUPABASE_STATUS_URL:  `https://<PROJECT>.functions.supabase.co/job-status`
- SUPABASE_WEBHOOK_SECRET: same value as Supabase `WEBHOOK_SECRET`

5. Deploy
- Push to `main` (or your configured branch); Pages builds with `pages:build` and deploys.

## 3) Local verification (optional)
```
# One-time adapter setup (writes .vercel/output config)
npm run pages:setup

# Build and preview locally
npm run pages:build
npm run pages:dev
```

## Notes
- The thumbnails page now enqueues a job and polls /api/status until done.
- Results are served from Supabase Storage (public URLs) and shown directly.
- If you want immediate processing without cron, modify `process-generate` to call `run-job` after insert.

