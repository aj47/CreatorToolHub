export type ProfileId =
  | 'vlog'
  | 'podcast'
  | 'screencast'
  | 'news'
  | 'gaming'
  | 'interview';

export type ProfileSpec = {
  title: string;
  prompt: string; // exact prompt to be given to model
};

export const profiles: Record<ProfileId, ProfileSpec> = {
  vlog: {
    title: 'Vlog',
    prompt:
      'Create a high-energy vlog thumbnail with the main person as the central focus. Position the subject prominently using rule of thirds composition. Apply vibrant, high-contrast styling with a slightly blurred background for depth. Use bold, readable typography (3-5 words max) with strong outlines or drop shadows. Maintain a single clear focal point and avoid visual clutter.',
  },
  podcast: {
    title: 'Podcast',
    prompt:
      'Design a podcast thumbnail featuring the host(s) with professional presentation. Use side-by-side or split-screen layout for multiple hosts with clear visual separation. Include subtle audio-themed elements (waveforms, microphones) without overwhelming the composition. Apply balanced lighting and consistent color palette. Keep headlines short, bold, and highly legible.',
  },

  screencast: {
    title: 'Tech Screen Cast',
    prompt:
      'Design a tech screencast thumbnail featuring the presenter with excitement or engagement. Position the person using rule of thirds with stylized UI/interface elements in the background. Highlight key technical elements with subtle glowing effects. Use energetic but professional styling with bold, readable typography. Apply tech-appropriate color schemes and maintain high contrast for mobile viewing.',
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

  interview: {
    title: 'Interview',
    prompt:
      'Two subjects with clear contrast between them, balanced side-by-side composition. Include a concise topic label or badge. Use a studio or abstract background that does not distract. Give equal visual weight to both participants; keep the layout clean and readable.',
  },

};

