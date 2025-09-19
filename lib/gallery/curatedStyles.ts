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

const builtinCards: StyleCard[] = Object.entries(profiles)
  // Exclude certain built-in profiles from the gallery (still available elsewhere)
  .filter(([id]) => id !== "interview")
  .map(([id, p], i) => ({
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
      "Create a cinematic-style thumbnail with dramatic lighting and moody atmosphere. Use teal-orange color grading, shallow depth of field effects, and bold minimalist typography. Apply widescreen composition principles with strong visual hierarchy and atmospheric depth.",
    previewUrl: svgDataUrl("Cinematic", palette[9]),
  },
  {
    id: "minimal-clean",
    title: "Minimal Clean",
    prompt:
      "Design an ultra-clean, minimal thumbnail with maximum whitespace and strong typography hierarchy. Use a limited color palette (2-3 colors max), large sans-serif headlines, and simple geometric shapes for accent. Focus on clarity and readability above all else.",
    previewUrl: svgDataUrl("Minimal Clean", palette[11]),
  },
  // Reference-image-based templates


  {
    id: "ref-product",
    title: "Ref: Product Focus",
    prompt: "Create a product-focused thumbnail with clean, professional styling. Feature the main subject (person/product) prominently with crisp edges and subtle drop shadows. Use minimal, bold typography with high contrast. Maintain a clean background that doesn't compete with the subject. Apply modern, sleek visual treatment with plenty of white space.",
    previewUrl: "/references/product.jpg",
    referenceImages: ["/references/product.jpg"],
  },
  {
    id: "ref-contrast",
    title: "Ref: High Impact",
    prompt: "Design a high-impact thumbnail with dramatic contrast and bold visual hierarchy. Use strong color separation between foreground and background. Feature the main subject with prominent positioning and clear focal emphasis. Apply bold, readable typography with strong outlines or shadows. Create visual tension through contrasting elements while maintaining clarity.",
    previewUrl: "/references/contrast.jpg",
    referenceImages: ["/references/contrast.jpg"],
  },
  {
    id: "ref-comparison",
    title: "Ref: Split Layout",
    prompt: "Create a comparison-style thumbnail with clear visual separation between two sides or concepts. Use distinct color zones or dividers to separate content areas. Position subjects or elements to emphasize the comparison or before/after concept. Apply consistent typography across both sides while maintaining visual balance and hierarchy.",
    previewUrl: "/references/comparison.jpg",
    referenceImages: ["/references/comparison.jpg"],
  },
  {
    id: "ref-aicoding",
    title: "Ref: Tech Style",
    prompt: "Design a tech-focused thumbnail with modern, digital aesthetics. Incorporate clean lines, subtle gradients, and professional color schemes. Feature the main subject with tech-appropriate styling - clean backgrounds, modern typography, and subtle tech-inspired visual elements. Maintain high readability with clear contrast and professional presentation.",
    previewUrl: "/references/aicoding.jpg",
    referenceImages: ["/references/aicoding.jpg"],
  },


];

export const curatedStyles: StyleCard[] = [...builtinCards, ...extras];

export const curatedMap: Record<string, StyleCard> = Object.fromEntries(
  curatedStyles.map((s) => [s.id, s])
);

export function isBuiltinProfileId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(profiles as Record<string, unknown>, id);
}

