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
  label: string;
  template: string; // short style guidance injected into prompt
};

export const profiles: Record<ProfileId, ProfileSpec> = {
  vlog: {
    label: 'Vlog',
    template:
      'Energetic color pops, diagonal composition, big expressive face cutout, slightly blurred background, large outlined text. Keep text extremely legible on mobile.',
  },
  podcast: {
    label: 'Podcast',
    template:
      'Two heads side-by-side or split-screen, topic badge, subtle studio or waveform motif, consistent palette. Ensure host faces are clear and text is bold.',
  },
  tutorial: {
    label: 'Tutorial/How-to',
    template:
      'UI background crop with glow around key UI element, arrow/shape callouts, crisp sans-serif headline, clean layout with high contrast.',
  },
  screencast: {
    label: 'Tech Screen Cast',
    template:
      'Tech screencast style: slightly blurred UI screenshot as background, enlarge and glow a key UI element (button or icon) as focal point, add influencer face cutout on left or right third with clear emotion, bold short headline with strong outline. Ensure high contrast and mobile legibility.',
  },
  news: {
    label: 'News/Commentary',
    template:
      'Strong color bars and punchy headline, subtle ticker or lower-third motif, authoritative tone, minimal clutter, clear hierarchy.',
  },
  gaming: {
    label: 'Gaming',
    template:
      'High saturation, character or avatar cutout, neon accents, bold numbers/emotes, motion streaks, exciting dynamic lighting.',
  },
  review: {
    label: 'Review/Unboxing',
    template:
      'Product hero cutout with soft shadow, rating-style badge or verdict tag, clean backdrop, accent color to draw attention to the product.',
  },
  interview: {
    label: 'Interview',
    template:
      'Two faces with contrast between subjects, topic label, studio or abstract backdrop, balanced composition to feature both participants equally.',
  },
  shorts: {
    label: 'Shorts/Reels',
    template:
      'Vertical 9:16 framing, single focal subject, very large text with strong outline, safe margins for platform UI overlays.',
  },
};

