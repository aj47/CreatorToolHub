import { profiles } from "../prompt/profiles";

export type StyleCard = {
  id: string;
  title: string;
  prompt: string;
  colors?: string[];
  referenceImages?: string[];
  previewUrl: string;
  builtin?: boolean;
};

const palette = [
  "#4F46E5",
  "#059669",
  "#DC2626",
  "#7C3AED",
  "#2563EB",
  "#EA580C",
  "#16A34A",
  "#DB2777",
  "#0EA5E9",
  "#64748B",
  "#F59E0B",
  "#14B8A6",
];

function svgDataUrl(label: string, bg: string, fg = "#ffffff"): string {
  const text = label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='480' height='270' viewBox='0 0 480 270'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='${bg}' stop-opacity='0.95'/>
      <stop offset='100%' stop-color='${bg}' stop-opacity='0.8'/>
    </linearGradient>
  </defs>
  <rect width='100%' height='100%' fill='url(#g)'/>
  <rect x='16' y='16' width='448' height='238' rx='12' ry='12' fill='rgba(0,0,0,0.18)'/>
  <text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='Inter, ui-sans-serif, system-ui' font-size='28' font-weight='700' fill='${fg}'>${text}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const builtinCards: StyleCard[] = Object.entries(profiles).map(([id, p], i) => ({
  id,
  title: p.title,
  prompt: p.prompt,
  previewUrl: svgDataUrl(p.title, palette[i % palette.length]),
  builtin: true,
}));

const extras: StyleCard[] = [
  {
    id: "cinematic",
    title: "Cinematic",
    prompt:
      "Moody teal-orange grade, shallow depth of field subject, widescreen bars motif, bold minimalist title, dramatic lighting and atmosphere.",
    previewUrl: svgDataUrl("Cinematic", palette[9]),
  },
  {
    id: "retro-vaporwave",
    title: "Retro Vaporwave",
    prompt:
      "80s retro vaporwave aesthetic: neon grid, sunset gradient, chrome text, palm silhouettes, nostalgic synthwave vibe with high contrast.",
    previewUrl: svgDataUrl("Retro Vaporwave", palette[10]),
  },
  {
    id: "minimal-mono",
    title: "Minimal Mono",
    prompt:
      "Ultra minimal black-and-white style, large sans-serif headline, single accent shape, high whitespace and strong hierarchy for clarity.",
    previewUrl: svgDataUrl("Minimal Mono", palette[11]),
  },
  // Reference-image-based templates
  {
    id: "ref-vlog",
    title: "Ref: Vlog",
    prompt: "Vlog style thumbnail. Keep text large and expressive; strong face presence; high contrast.",
    previewUrl: "/references/vlog.jpg",
    referenceImages: ["/references/vlog.jpg"],
  },
  {
    id: "ref-studio",
    title: "Ref: Studio",
    prompt: "Studio style: clean lighting, subtle background, strong subject separation.",
    previewUrl: "/references/studio.jpg",
    referenceImages: ["/references/studio.jpg"],
  },
  {
    id: "ref-product",
    title: "Ref: Product",
    prompt: "Product hero emphasis. Crisp edges, soft shadow, and a bold, minimal headline.",
    previewUrl: "/references/product.jpg",
    referenceImages: ["/references/product.jpg"],
  },
  {
    id: "ref-contrast",
    title: "Ref: High Contrast",
    prompt: "High-contrast palette with clear focal point and strong hierarchy.",
    previewUrl: "/references/contrast.jpg",
    referenceImages: ["/references/contrast.jpg"],
  },
  {
    id: "ref-comparison",
    title: "Ref: Comparison",
    prompt: "Comparison layout: two-panel feel, distinct sides, concise labels.",
    previewUrl: "/references/comparison.jpg",
    referenceImages: ["/references/comparison.jpg"],
  },
  {
    id: "ref-aicoding",
    title: "Ref: AI Coding",
    prompt: "Follow this reference closely: composition, color palette, typography, and text placement. Keep all text highly legible.",
    previewUrl: "/references/aicoding.jpg",
    referenceImages: ["/references/aicoding.jpg"],
  },
  {
    id: "ref-interview",
    title: "Ref: Interview",
    prompt: "Interview style: two-person framing or presenter focus, strong headline bar, clear hierarchy, high contrast and legibility.",
    previewUrl: "/references/interview.jpg",
    referenceImages: ["/references/interview.jpg"],
  },
  {
    id: "ref-showcase",
    title: "Ref: Showcase",
    prompt: "Showcase layout: featured subject/product centered, supporting accents, balanced whitespace, bold readable title.",
    previewUrl: "/references/showcase.jpg",
    referenceImages: ["/references/showcase.jpg"],
  }
];

export const curatedStyles: StyleCard[] = [...builtinCards, ...extras];

export const curatedMap: Record<string, StyleCard> = Object.fromEntries(
  curatedStyles.map((s) => [s.id, s])
);

export function isBuiltinProfileId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(profiles as Record<string, unknown>, id);
}

