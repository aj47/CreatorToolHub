/**
 * Base prompt system for thumbnail generation
 * Ensures consistent quality and prevents reference image contamination
 */

export type AspectRatio = '16:9' | '9:16' | '1:1';

export interface BasePromptConfig {
  aspect: AspectRatio;
  hasReferenceImages: boolean;
  hasSubjectImages: boolean;
}

/**
 * Core system prompt that establishes the AI's role and fundamental constraints
 */
export const SYSTEM_PROMPT = `You are a YouTube Thumbnail Art Director. Generate exactly one image that maximizes mobile legibility and click-through rate while remaining truthful and non-deceptive.`;

/**
 * Technical constraints that must always be enforced
 */
export function getTechnicalConstraints(aspect: AspectRatio): string {
  const dimensions = {
    '16:9': '1280x720',
    '9:16': '1080x1920', 
    '1:1': '1080x1080'
  };

  return `TECHNICAL REQUIREMENTS:
- Aspect ratio: ${aspect}
- Resolution: ${dimensions[aspect]} pixels
- High contrast for mobile visibility
- Single clear focal subject
- Avoid tiny text and visual clutter
- Ensure all text is highly legible on small screens`;
}

/**
 * Reference image handling instructions - much more specific and strict
 */
export const REFERENCE_INSTRUCTIONS = `REFERENCE IMAGE USAGE (CRITICAL):
The first image(s) are REFERENCE ONLY for style and layout. Follow these rules strictly:
1. COPY: Composition, layout structure, color palette, typography style, text placement
2. DO NOT COPY: Any people, faces, objects, or specific content from reference images
3. REPLACE: All subjects/people in the reference with subjects from the user's provided images
4. MAINTAIN: The overall visual style, mood, and design approach of the reference
5. If reference shows a person, replace with person from user images in same position/style
6. If reference shows objects, replace with relevant objects from user content
7. Keep the reference's text styling but use appropriate text for the user's content`;

/**
 * Subject image handling instructions
 */
export const SUBJECT_INSTRUCTIONS = `SUBJECT IMAGE USAGE:
The provided subject images contain the people, objects, and content to feature in the thumbnail:
1. Use faces and people from these images as the main subjects
2. Extract relevant objects, UI elements, or scenes as needed
3. Apply the reference style to these subjects
4. Maintain the subjects' identity and key characteristics
5. Position subjects according to the reference layout`;

/**
 * Quality and safety constraints
 */
export const QUALITY_CONSTRAINTS = `QUALITY REQUIREMENTS:
- Ensure maximum contrast and readability
- Use bold, clear typography with proper spacing
- Maintain visual hierarchy with clear focal points
- Avoid misleading or clickbait elements
- Keep composition clean and uncluttered
- Optimize for mobile viewing experience`;

/**
 * Builds the complete base prompt with all constraints
 */
export function buildBasePrompt(config: BasePromptConfig): string {
  const parts = [
    SYSTEM_PROMPT,
    getTechnicalConstraints(config.aspect),
  ];

  if (config.hasReferenceImages) {
    parts.push(REFERENCE_INSTRUCTIONS);
  }

  if (config.hasSubjectImages) {
    parts.push(SUBJECT_INSTRUCTIONS);
  }

  parts.push(QUALITY_CONSTRAINTS);

  return parts.join('\n\n');
}

/**
 * Validates and enhances template prompts to work with the base system
 */
export function enhanceTemplatePrompt(templatePrompt: string, hasReference: boolean): string {
  if (!templatePrompt || templatePrompt.trim().length === 0) {
    return "Create a professional, high-impact thumbnail following the established style guidelines.";
  }

  // If it's a reference-based template with a very short prompt, enhance it
  if (hasReference && templatePrompt.length < 100) {
    return `STYLE DIRECTION: ${templatePrompt}

Apply this style direction while strictly following the reference image usage rules above. Focus on recreating the reference's visual approach, composition, and mood while using only the subjects and content from the user's provided images.`;
  }

  return templatePrompt;
}
