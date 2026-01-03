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

const builtinCards: StyleCard[] = Object.entries(profiles)
  .map(([id, p]) => ({
    id,
    title: p.title,
    prompt: p.prompt,
    previewUrl: `/template-previews/${id}.png`,
    builtin: true,
  }));

const extras: StyleCard[] = [
  {
    id: "metric-showdown",
    title: "Metric Showdown",
    prompt:
      "Create a data comparison thumbnail with extreme numerical contrast as the hero element. Display two large, bold numbers in a versus/comparison layout (e.g., '7,000 vs 90' or 'Before: X / After: Y'). Use a dark, tech-forward background with subtle matrix-style or grid textures. Apply a single bright accent color (green, cyan, or yellow) to highlight the 'winning' or 'after' number. Include one simple icon or graphic element (brain, chart, or tech symbol) as a visual anchor. NO human faces. Maintain maximum contrast for mobile legibility. Typography should be massive and numeric-focused with minimal supporting text.",
    previewUrl: "/template-previews/metric-showdown.png",
    colors: ["#0A0A0A", "#22C55E", "#FBBF24"],
  },
  {
    id: "cinematic",
    title: "Cinematic",
    prompt:
      "Create a cinematic-style thumbnail with dramatic lighting and moody atmosphere. Use teal-orange color grading, shallow depth of field effects, and bold minimalist typography. Apply widescreen composition principles with strong visual hierarchy and atmospheric depth.",
    previewUrl: "/template-previews/cinematic.png",
  },
  {
    id: "software-review",
    title: "Software Review",
    prompt:
      "Design a software review thumbnail that prominently showcases the product logo alongside an interface motif. Use a clean split layout with the logo or icon anchored on one side. If comparing tools or showing results, use large bold numbers or percentages as the focal point rather than text descriptions. Apply a dark background with one bright accent color for key metrics. Keep text minimal (2-4 words max) with at least one keyword highlighted using a contrasting color. Maintain high contrast for mobile viewing.",
    previewUrl: "/template-previews/software-review.png",
    colors: ["#0F172A", "#38BDF8", "#FBBF24"],
  },
  {
    id: "minimal-highlight",
    title: "Minimal Highlight",
    prompt:
      "Take the main element(s) from reference images and place to one side. The other side should have a short clickbait statement with one or two keywords highlighted in bright yellow. The background is dark and can be very subtly textured or have a grid.",
    previewUrl: "/template-previews/minimal-highlight.png",
  }
];

export const curatedStyles: StyleCard[] = [...builtinCards, ...extras];

export const curatedMap: Record<string, StyleCard> = Object.fromEntries(
  curatedStyles.map((s) => [s.id, s])
);

export function isBuiltinProfileId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(profiles as Record<string, unknown>, id);
}

