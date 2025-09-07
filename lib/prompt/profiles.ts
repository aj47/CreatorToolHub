export type ProfileId =
  | 'vlog'
  | 'podcast'
  | 'tutorial'
  | 'screencast'
  | 'news'
  | 'gaming'
  | 'review'
  | 'interview'
  | 'shorts';

export type ProfileSpec = {
  title: string;
  prompt: string; // exact prompt to be given to model
};

export const profiles: Record<ProfileId, ProfileSpec> = {
  vlog: {
    title: 'Vlog',
    prompt:
      'Energetic color pops, diagonal composition, big expressive face cutout, slightly blurred background, large outlined text. Keep text extremely legible on mobile.',
  },
  podcast: {
    title: 'Podcast',
    prompt:
      'Two heads side-by-side or split-screen, topic badge, subtle studio or waveform motif, consistent palette. Ensure host faces are clear and text is bold.',
  },
  tutorial: {
    title: 'Tutorial/How-to',
    prompt:
      'UI background crop with glow around key UI element, arrow/shape callouts, crisp sans-serif headline, clean layout with high contrast.',
  },
  screencast: {
    title: 'Tech Screen Cast',
    prompt:
      'Tech screencast style: slightly blurred UI screenshot as background, enlarge and glow a key UI element (button or icon) as focal point, add influencer face cutout on left or right third with clear emotion, bold short headline with strong outline. Ensure high contrast and mobile legibility.',
  },
  news: {
    title: 'News/Commentary',
    prompt:
      'Strong color bars and punchy headline, subtle ticker or lower-third motif, authoritative tone, minimal clutter, clear hierarchy.',
  },
  gaming: {
    title: 'Gaming',
    prompt:
      'High saturation, character or avatar cutout, neon accents, bold numbers/emotes, motion streaks, exciting dynamic lighting.',
  },
  review: {
    title: 'Review/Unboxing',
    prompt:
      'Product hero cutout with soft shadow, rating-style badge or verdict tag, clean backdrop, accent color to draw attention to the product.',
  },
  interview: {
    title: 'Interview',
    prompt:
      'Two faces with contrast between subjects, topic label, studio or abstract backdrop, balanced composition to feature both participants equally.',
  },
  shorts: {
    title: 'Shorts/Reels',
    prompt:
      'Vertical 9:16 framing, single focal subject, very large text with strong outline, safe margins for platform UI overlays.',
  },
};

