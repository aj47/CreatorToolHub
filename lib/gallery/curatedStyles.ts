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
    id: "software-review",
    title: "Software Review",
    prompt:
      "Design a software review thumbnail that prominently showcases the product logo alongside an interface motif. Use a clean split layout with the logo or icon anchored on one side and a large, bold headline where at least one keyword is highlighted using a contrasting color bar or underline. Apply modern, tech-forward styling with crisp lighting, subtle gradients, and balanced spacing to convey clarity and trust.",
    previewUrl: svgDataUrl("Software Review", palette[10]),
    colors: ["#0F172A", "#38BDF8", "#FBBF24"],
  },
  {
    id: "premium-saas-dark",
    title: "Premium SaaS Dark",
    prompt:
      "Create a high-contrast, dark-mode premium SaaS thumbnail with pure black background. Use electric periwinkle/indigo blue (#6366F1) as the primary accent for headlines, key metrics, and data points. Apply clean modern sans-serif typography (Inter/SF Pro style) with large bold sentence-case headlines in white. Include minimal data visualization elements: horizontal performance axis with dotted guide lines, circular markers with numeric labels, and small arrows. Add subtle legend with colored dots. Use lots of negative space, maintain minimalist aesthetic with no clutter. Apply soft card shadow and keep all borders minimal. Include small all-caps footnote for technical precision. Typography should use tight letter-spacing for labels and axis text to create analytical, technical feel.",
    previewUrl: svgDataUrl("Premium SaaS Dark", "#000000", "#6366F1"),
    colors: ["#000000", "#1F1F1F", "#6366F1", "#E5E7EB", "#9CA3AF"],
  },
  {
    id: "minimal-highlight",
    title: "Minimal Highlight",
    prompt: 
      "Take the main element(s) from reference images and place to one side. The other side should have a short clickbait statement with one or two keywords highlighted in bright yellow. The background is dark and can be very subtly textured or have a grid.",
    previewUrl: svgDataUrl("Minimal Highlight", "#000000", "#ffff00ff"),
  }
];

export const curatedStyles: StyleCard[] = [...builtinCards, ...extras];

export const curatedMap: Record<string, StyleCard> = Object.fromEntries(
  curatedStyles.map((s) => [s.id, s])
);

export function isBuiltinProfileId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(profiles as Record<string, unknown>, id);
}

