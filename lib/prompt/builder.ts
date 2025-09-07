import { profiles, ProfileId } from './profiles';

export function buildPrompt(p: {
  profile: string; // allow custom ids
  promptOverride?: string; // if provided, use instead of built-in profile prompt
  headline?: string;
  colors?: string[];
  aspect: '16:9' | '9:16' | '1:1';
  notes?: string; // advanced free-form additions
}) {
  const sys = 'You are a YouTube Thumbnail Art Director. Generate exactly one image. Maximize mobile legibility and CTR while remaining truthful and non-deceptive.';

  const size = p.aspect === '9:16' ? '1080x1920' : p.aspect === '1:1' ? '1080x1080' : '1280x720';
  const base = `Aspect ${p.aspect}, resolution ${size}. Use high contrast and a single clear focal subject. Avoid tiny text and clutter.`;

  const builtin = profiles[(p.profile as ProfileId)]?.prompt ?? '';
  const exact = (p.promptOverride && p.promptOverride.trim().length > 0) ? p.promptOverride : builtin;

  const briefLines = [
    p.headline ? `Headline: "${p.headline}"` : undefined,
    p.colors && p.colors.length ? `Colors: ${p.colors.join(', ')}` : undefined,
  ].filter(Boolean) as string[];

  const brief = briefLines.length ? ['Design Brief:', ...briefLines].join('\n') : undefined;
  const extra = p.notes ? `Notes: ${p.notes}` : '';

  // Use the prompt as-is; prepend system/base guidance and optional brief/notes
  return [sys, base, exact, brief, extra]
    .filter(Boolean)
    .join('\n\n');
}

