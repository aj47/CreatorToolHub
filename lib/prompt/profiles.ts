export type ProfileSpec = {
  title: string;
  prompt: string; // exact prompt to be given to model
};

// Single source of truth: define profiles here
// ProfileId type is automatically derived from this object
export const profiles = {
  vlog: {
    title: 'Vlog',
    prompt:
      'Create a high-energy vlog thumbnail with the main person as the central focus. Position the subject prominently using rule of thirds composition. Apply vibrant, high-contrast styling with a slightly blurred background for depth. Use bold, readable typography (3-5 words max) with strong outlines or drop shadows. Maintain a single clear focal point and avoid visual clutter.',
  },
  podcast: {
    title: 'Podcast',
    prompt:
      'Design a podcast thumbnail featuring the host(s) with professional presentation. Include multiple hosts together, possibly in a side by side or split-screen layout. Apply balanced lighting and consistent color palette. Keep headlines short, bold, and highly legible.',
  },
  screencast: {
    title: 'Tech Screen Cast',
    prompt:
      'Design a tech screencast thumbnail featuring the presenter with excitement or engagement. Position the person using rule of thirds with stylized UI/interface elements in the background. Highlight key technical elements with subtle glowing effects. Use energetic styling with bold, readable typography.  Maintain high contrast for mobile viewing along with highlights and shadows.',
  },
  gaming: {
    title: 'Vibrant',
    prompt:
      'High-saturation gaming aesthetic with a character or avatar cutout as the focal subject. Add neon accents, motion streaks, and dynamic lighting for energy. Use bold numbers/emotes or a short callout if appropriate. Maintain extreme contrast and ensure everything reads on mobile.',
  },
} as const satisfies Record<string, ProfileSpec>;

// Derive ProfileId type from the profiles object keys
// This ensures ProfileId is always in sync with the actual profiles
export type ProfileId = keyof typeof profiles;


