// Utility functions for storage operations

/**
 * Generate a consistent user ID from email
 * Same logic as used in the main app for Autumn customer ID
 */
export function deriveUserId(email: string): string {
  const raw = email.toLowerCase();
  const cleaned = raw
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+/, "")
    .replace(/[-_]+$/, "");
  return ("u-" + cleaned).slice(0, 40);
}

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate R2 object key for user files
 */
export type R2KeyType = 'template-reference' | 'generation-output' | 'generation-input' | 'misc';

export interface GenerateR2KeyOptions {
  templateId?: string;
  generationId?: string;
  variantIndex?: number;
  filename?: string;
  extension?: string;
}

export function generateR2Key(userId: string, type: R2KeyType, options: GenerateR2KeyOptions = {}): string {
  const uuid = generateUUID();
  const rawExtension = options.extension || getFileExtension(options.filename || '');
  const extension = rawExtension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';

  switch (type) {
    case 'template-reference': {
      if (!options.templateId) {
        throw new Error('templateId is required to generate template reference key');
      }
      return `users/${userId}/templates/${options.templateId}/references/${uuid}.${extension}`;
    }
    case 'generation-output': {
      if (!options.generationId) {
        throw new Error('generationId is required to generate generation output key');
      }
      const variant = options.variantIndex ?? 0;
      return `users/${userId}/generations/${options.generationId}/outputs/${variant}-${uuid}.${extension}`;
    }
    case 'generation-input': {
      if (!options.generationId) {
        throw new Error('generationId is required to generate generation input key');
      }
      return `users/${userId}/generations/${options.generationId}/inputs/${uuid}.${extension}`;
    }
    default:
      return `users/${userId}/files/${uuid}.${extension}`;
  }
}

/**
 * Extract file extension from filename
 */
export function getFileExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : 'bin';
}

/**
 * Validate image file type
 */
export function isValidImageType(contentType: string): boolean {
  const validTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/tiff',
    'image/tif'
  ];
  return validTypes.includes(contentType.toLowerCase());
}

/**
 * Validate file size (max 25MB)
 */
export function isValidFileSize(sizeBytes: number): boolean {
  const MAX_SIZE = 25 * 1024 * 1024; // 25MB
  return sizeBytes <= MAX_SIZE;
}

/**
 * Generate signed URL for R2 object (valid for 1 hour)
 */
export async function generateSignedUrl(r2: any, key: string): Promise<string> {
  const object = await r2.get(key);
  if (!object) {
    throw new Error('Object not found');
  }

  // For now, return a simple URL - in production you'd want proper signed URLs
  // This is a placeholder - Cloudflare R2 signed URLs require additional setup
  return `https://your-r2-domain.com/${key}`;
}

/**
 * Calculate SHA-256 hash of file content
 */
export async function calculateFileHash(content: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert database row to API response format
 */
export function convertUserTemplateRow(row: any): any {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    prompt: row.prompt,
    colors: row.colors ? JSON.parse(row.colors) : [],
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function convertUserSettingsRow(row: any): any {
  return {
    user_id: row.user_id,
    favorites: row.favorites ? JSON.parse(row.favorites) : {},
    show_only_favs: Boolean(row.show_only_favs),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function convertGenerationRow(row: any): any {
  return {
    id: row.id,
    user_id: row.user_id,
    template_id: row.template_id || undefined,
    prompt: row.prompt,
    variants_requested: typeof row.variants_requested === 'number' ? row.variants_requested : Number(row.variants_requested) || 1,
    status: row.status,
    source: row.source || undefined,
    parent_generation_id: row.parent_generation_id || undefined,
    error_message: row.error_message || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function convertGenerationOutputRow(row: any): any {
  return {
    id: row.id,
    generation_id: row.generation_id,
    variant_index: typeof row.variant_index === 'number' ? row.variant_index : Number(row.variant_index) || 0,
    r2_key: row.r2_key,
    mime_type: row.mime_type,
    width: row.width === null || row.width === undefined ? undefined : Number(row.width),
    height: row.height === null || row.height === undefined ? undefined : Number(row.height),
    size_bytes: row.size_bytes === null || row.size_bytes === undefined ? undefined : Number(row.size_bytes),
    hash: row.hash || undefined,
    created_at: row.created_at
  };
}

export function convertGenerationInputRow(row: any): any {
  return {
    id: row.id,
    generation_id: row.generation_id,
    input_type: row.input_type,
    source_id: row.source_id || undefined,
    r2_key: row.r2_key || undefined,
    hash: row.hash || undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    created_at: row.created_at
  };
}


/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
