# CreatorToolHub

A collection of creator tools. The `thumbnailer/` app is a Next.js project that generates YouTube-style thumbnails with AI.

## Thumbnailer overview
- Framework: Next.js (App Router)
- Model Client: `@google/genai`
- Main page: `thumbnailer/app/page.tsx`
- API route: `thumbnailer/app/api/generate/route.ts`
- Template gallery: `thumbnailer/components/TemplateGallery.tsx`
- Curated styles: `thumbnailer/lib/gallery/curatedStyles.ts`
- Prompt builder: `thumbnailer/lib/prompt/builder.ts`
- Built-in profiles: `thumbnailer/lib/prompt/profiles.ts`

## Template model (refactored)
Templates now consist of exactly these fields:

```ts
export type Template = {
  title: string;            // human-readable card name
  prompt: string;           // exact prompt text sent to the model (no auto-expansion)
  colors: string[];         // suggested hex colors (optional)
  referenceImages: string[];// optional URLs or data URLs to append as image inputs
};
```

Where they are used:
- UI type alias: `type Preset` in `thumbnailer/app/page.tsx` and `components/TemplateGallery.tsx`
- Curated cards: `thumbnailer/lib/gallery/curatedStyles.ts`
- Built-ins (profiles): `thumbnailer/lib/prompt/profiles.ts` use `{ title, prompt }`

## Reference images
- Optional per-template
- Appended (up to 3) to the frames captured from video and sent to the model
- Samples live under `thumbnailer/public/references`
  - `vlog.jpg`, `studio.jpg`, `product.jpg`, `contrast.jpg`, `comparison.jpg`
- Curated entries were added to display these reference images as the card preview

## Local storage keys (v2)
- Custom templates: `cg_custom_presets_v2`
  - Migrates from `cg_custom_presets_v1` automatically (label/template → title/prompt)
- Favorites: `cg_style_favs_v2`

## Running locally
From the repository root:

```bash
cd thumbnailer
npm install
npm run dev
```

Then open http://localhost:3000

Build for production:

```bash
cd thumbnailer
npm run build
npm start
```

Note: Next.js may warn about multiple lockfiles. The app will still build/run.

## API: /api/generate
- Method: POST
- Body fields:
  - `prompt: string` (final composed prompt)
  - `frames: string[]` (base64 PNGs, max 3; may include reference images)
  - `variants?: number` (1–8)
- Returns: `{ images: string[] }` with base64 PNGs

## Adding curated templates that use reference images
1) Place your images under `thumbnailer/public/references` (or a subfolder)
2) Add a new entry to `thumbnailer/lib/gallery/curatedStyles.ts` with:

```ts
{
  id: "ref-my-style",
  title: "Ref: My Style",
  prompt: "Describe the style succinctly…",
  previewUrl: "/references/my-style.jpg",
  referenceImages: ["/references/my-style.jpg"],
}
```

These will show up in the Template Gallery with the image as the preview.

## Notes & limitations
- We cap total image inputs to 3 for the model request (captured frames + reference images)
- The prompt builder now uses your template prompt as-is, plus optional headline/colors/notes

## Contributing
- Small changes: branch off `main`, open a PR
- Please keep template edits consistent with the schema above
- Consider adding reference images when appropriate to make templates visually discoverable

## License
MIT (unless otherwise noted in subfolders)
