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
      'High-saturation, energetic vlog aesthetic with the main person as a bold cutout focal subject. Add dynamic lighting, motion streaks, and vibrant color pops for maximum energy. Apply dramatic depth with rich background gradients. Use oversized, bold typography (2-4 words max) with strong glowing outlines or dramatic drop shadows. Maintain extreme contrast and ensure facial expressions and text pop on mobile.',
  },
  podcast: {
    title: 'Podcast',
    prompt:
      'Vibrant, engaging podcast aesthetic with host(s) as prominent cutout subjects in dynamic, conversational poses. Apply dramatic lighting, rich color gradients, and depth-creating shadows for visual interest. Use split-screen or rule-of-thirds composition for multiple hosts. Add bold, oversized typography with contrasting accent colors highlighting key words. Maintain high saturation and ensure facial expressions and text remain crystal clear on mobile.',
  },
  screencast: {
    title: 'Tech Screen Cast',
    prompt:
      'High-contrast, modern tech aesthetic with the presenter as a clean cutout focal point showing genuine excitement. Apply dramatic lighting, neon UI accents, and glowing highlights on key technical elements. Position using rule of thirds with stylized interface elements as dynamic background layers. Use bold, sans-serif typography with keyword highlighting via contrasting color bars. Maintain extreme contrast and ensure all text and UI elements read perfectly on mobile screens.',
  },
  gaming: {
    title: 'Vibrant',
    prompt:
      'High-saturation gaming aesthetic with a character or avatar cutout as the focal subject. Add neon accents, motion streaks, and dynamic lighting for energy. Use bold numbers/emotes or a short callout if appropriate. Maintain extreme contrast and ensure everything reads on mobile.',
  },
  tutorial: {
    title: 'Tutorial',
    prompt:
      'High-contrast, clear educational aesthetic with the instructor as a prominent cutout focal point. Apply clean lighting, step-indicator graphics, and highlighted UI elements for clarity. Use bold, sans-serif typography with numbered steps or key terms highlighted via color blocks. Incorporate before/after comparisons or process indicators as visual aids. Maintain extreme contrast and ensure all instructional elements are instantly readable on mobile.',
  },
  music: {
    title: 'Music',
    prompt:
      'Ultra-vibrant, high-energy music aesthetic with the artist as a dynamic cutout in an expressive pose. Add neon accents, particle effects, audio waveforms, and dramatic lighting for maximum visual rhythm. Apply bold color gradients with music-themed elements like equalizers, notes, or instruments as atmospheric layers. Use chunky, bold typography with strong outlines matching the beat\'s energy. Maintain extreme contrast and ensure all elements pulse with clarity on mobile.',
  },
} as const satisfies Record<string, ProfileSpec>;

// Derive ProfileId type from the profiles object keys
// This ensures ProfileId is always in sync with the actual profiles
export type ProfileId = keyof typeof profiles;


