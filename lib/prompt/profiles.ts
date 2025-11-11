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
  devtool: {
    title: 'Developer Tool',
    prompt:
      'Vibrant, high-impact developer tool aesthetic with the presenter as a bold cutout showing excitement or discovery. Apply dramatic lighting with glowing tool icons, tech logos (React, VS Code, GitHub, etc.), UI mockups, and feature callouts as layered elements. Use chunky, bold typography with tool names or key features highlighted in contrasting neon colors. Incorporate before/after code comparisons, productivity metrics, or star ratings as visual proof points. Add recognizable tech brand logos and framework icons as prominent visual anchors. Maintain extreme saturation and ensure all tool details, logos, and text read perfectly on mobile screens.',
  },
  codelist: {
    title: 'Code Listicle',
    prompt:
      'Bold, educational coding aesthetic with the presenter as a prominent cutout positioned alongside oversized programming language logos, framework icons, or tech brand symbols (Python, JavaScript, React, Angular, Vue, etc.). Apply clean, high-contrast split-screen composition with the subject on one side and massive, colorful tech logos or code symbols on the other. Use chunky, ultra-bold typography with numbers (10, 100) or list indicators prominently displayed in contrasting color blocks or banners. Add subtle code patterns, syntax highlighting, or geometric shapes as background texture. Include recognizable tech stack icons arranged in grids or clusters as visual anchors. Maintain extreme contrast with bold color blocking and ensure all logos, numbers, and text are instantly readable on mobile.',
  },
} as const satisfies Record<string, ProfileSpec>;

// Derive ProfileId type from the profiles object keys
// This ensures ProfileId is always in sync with the actual profiles
export type ProfileId = keyof typeof profiles;


