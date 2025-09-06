import { profiles, ProfileId } from './profiles';

export function buildPrompt(p: {
  profile: string; // allow custom ids
  templateOverride?: string; // if provided, use instead of built-in profile template
  headline?: string;
  colors?: string[];
  layout?: string;
  subject?: string;
  aspect: '16:9' | '9:16' | '1:1';
  notes?: string; // advanced free-form additions
}) {
  const sys = 'You are a YouTube Thumbnail Art Director. Generate exactly one image. Maximize mobile legibility and CTR while remaining truthful and non-deceptive.';

  const size = p.aspect === '9:16' ? '1080x1920' : p.aspect === '1:1' ? '1080x1080' : '1280x720';
  const base = `Aspect ${p.aspect}, resolution ${size}. Use high contrast and a single clear focal subject. Avoid tiny text and clutter.`;

  const builtin = profiles[(p.profile as ProfileId)]?.template ?? '';
  const style = (p.templateOverride && p.templateOverride.trim().length > 0) ? p.templateOverride : builtin;

  const briefLines = [
    p.headline ? `Headline: "${p.headline}"` : undefined,
    p.colors && p.colors.length ? `Colors: ${p.colors.join(', ')}` : undefined,
    p.layout ? `Layout prefs: ${p.layout}` : undefined,
    p.subject ? `Subject: ${p.subject}` : undefined,
  ].filter(Boolean) as string[];

  const brief = ['Design Brief:', ...briefLines].join('\n');
  const extra = p.notes ? `Notes: ${p.notes}` : '';

  return [sys, base, style ? `Style: ${style}` : undefined, brief, extra]
    .filter(Boolean)
    .join('\n\n');
}

