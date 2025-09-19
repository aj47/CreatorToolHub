import { profiles, ProfileId } from './profiles';
import { buildBasePrompt, enhanceTemplatePrompt, AspectRatio } from './basePrompt';

export function buildPrompt(p: {
  profile: string; // allow custom ids
  promptOverride?: string; // if provided, use instead of built-in profile prompt
  headline?: string;
  colors?: string[];
  aspect: AspectRatio;
  notes?: string; // advanced free-form additions
  hasReferenceImages?: boolean; // whether reference images are being used
  hasSubjectImages?: boolean; // whether subject images are being used
}) {
  // Build the comprehensive base prompt with all constraints
  const basePrompt = buildBasePrompt({
    aspect: p.aspect,
    hasReferenceImages: p.hasReferenceImages ?? false,
    hasSubjectImages: p.hasSubjectImages ?? false,
  });

  // Get the template-specific prompt
  const builtin = profiles[(p.profile as ProfileId)]?.prompt ?? '';
  const templatePrompt = (p.promptOverride && p.promptOverride.trim().length > 0) ? p.promptOverride : builtin;

  // Enhance the template prompt to work better with references
  const enhancedTemplate = enhanceTemplatePrompt(templatePrompt, p.hasReferenceImages ?? false);

  // Build the design brief
  const briefLines = [
    p.headline ? `Headline: "${p.headline}"` : undefined,
    p.colors && p.colors.length ? `Colors: ${p.colors.join(', ')}` : undefined,
  ].filter(Boolean) as string[];

  const brief = briefLines.length ? ['DESIGN BRIEF:', ...briefLines].join('\n') : undefined;

  // Parse notes to separate reference instructions from user notes
  const notes = p.notes ? `ADDITIONAL NOTES: ${p.notes}` : '';

  // Combine all parts with clear separation
  return [basePrompt, enhancedTemplate, brief, notes]
    .filter(Boolean)
    .join('\n\n');
}

