# Creator Tool Hub

A single Next.js app that hosts multiple creator tools. The first tool is the Thumbnail Creator at `/thumbnails`.

## Tech
- Next.js 15 (App Router)
- React 19, TypeScript
- Tailwind (via `@tailwindcss/postcss`), autoprefixer, `tailwindcss-animate`
- API uses Google Gemini via `@google/genai`

## Getting started

1) Install deps

```bash
npm install
```

2) Env vars (choose one key)

Create `.env.local` at the repo root with either:

```bash
GOOGLE_API_KEY=your_api_key_here
# or
GEMINI_API_KEY=your_api_key_here
```

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
