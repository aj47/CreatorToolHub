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
      'High-energy, high-contrast vlog aesthetic. Central focus is a large expressive face cutout from the uploaded frames, placed on the left or right third. Background is a stylized and slightly blurred version of the recorded scene to create depth. Add a short, bold 3–5 word headline with strong outline or drop shadow for maximum mobile legibility. Avoid clutter; keep a single clear focal point.',
  },
  podcast: {
    title: 'Podcast',
    prompt:
      'Two hosts presented side-by-side or in a split-screen layout with clear separation. Include a concise topic badge and a subtle studio or waveform motif. Make both faces clear and flattering with balanced lighting; keep the headline short and bold. Maintain a consistent palette; avoid overcrowding the frame.',
  },
  tutorial: {
    title: 'Tutorial/How-to',
    prompt:
      'Use a UI screenshot background related to the topic. Enlarge and softly glow a key UI element (button or icon) to create a focal point. Add clean arrow or shape callouts. Include a crisp sans-serif headline (3–5 words) with strong contrast. Keep the layout clean with ample negative space and clear hierarchy.',
  },
  screencast: {
    title: 'Tech Screen Cast',
    prompt:
      'Generate a YouTube thumbnail with a 16:9 aspect ratio and a resolution of 1280x720 pixels. The thumbnail should be vibrant and high-contrast, easily readable on a small mobile screen. The central focus is a cutout of the tech influencer from the webcam footage, expressing excitement or surprise, placed on the left or right third. The background is a stylized and slightly blurred version of the user interface from the screen share. Enlarge a key UI element (e.g., a primary button or sparkle icon) with a subtle glowing outline as a focal point. Include a short, bold 3–5 word sans-serif text overlay with strong contrast and a subtle outline or drop shadow. Use the provided Colors brief for brand palette, and keep the tone energetic and intriguing without misleading clickbait.',
  },
  news: {
    title: 'News/Commentary',
    prompt:
      'Authoritative news-style layout with strong color bars or a subtle ticker/lower-third motif. Headline is bold and highly legible with clear hierarchy. Use either a studio-style portrait or an abstract gradient background; keep the composition clean and uncluttered. Emphasize credibility and clarity over flashiness.',
  },
  gaming: {
    title: 'Gaming',
    prompt:
      'High-saturation gaming aesthetic with a character or avatar cutout as the focal subject. Add neon accents, motion streaks, and dynamic lighting for energy. Use bold numbers/emotes or a short callout if appropriate. Maintain extreme contrast and ensure everything reads on mobile.',
  },
  review: {
    title: 'Review/Unboxing',
    prompt:
      'Product-forward composition with a clean backdrop. Feature a crisp product hero cutout with a soft shadow; add a rating-style badge or verdict tag as a secondary element. Use an accent color to draw attention to the product. Keep the headline short and highly legible on mobile.',
  },
  interview: {
    title: 'Interview',
    prompt:
      'Two subjects with clear contrast between them, balanced side-by-side composition. Include a concise topic label or badge. Use a studio or abstract background that does not distract. Give equal visual weight to both participants; keep the layout clean and readable.',
  },
  shorts: {
    title: 'Shorts/Reels',
    prompt:
      'Vertical 9:16 framing with a single clear focal subject. Use very large text with a strong outline and safe margins for platform UI overlays. Keep the composition ultra-simple and high-contrast for instant recognition on mobile feeds.',
  },
};

