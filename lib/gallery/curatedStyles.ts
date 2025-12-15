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
      "Design a software review thumbnail that prominently showcases the product logo alongside an interface motif. Use a clean split layout with the logo or icon anchored on one side and a large, bold headline where at least one keyword is highlighted using a contrasting color bar or underline. Apply modern, tech-forward styling with crisp lighting, subtle gradients, and balanced spacing to convey clarity and trust.",
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

