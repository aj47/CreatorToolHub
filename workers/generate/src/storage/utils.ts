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
export function generateR2Key(userId: string, type: 'template' | 'image', subType?: string, filename?: string): string {
  const timestamp = Date.now();
  const uuid = generateUUID();
  
  if (type === 'template' && subType) {
    // templates/{template_id}/references/{image_id}.{ext}
    return `users/${userId}/templates/${subType}/references/${uuid}.${getFileExtension(filename || '')}`;
  } else if (type === 'image' && subType) {
    // images/frames/{image_id}.{ext} or images/references/{image_id}.{ext}
    return `users/${userId}/images/${subType}/${uuid}.${getFileExtension(filename || '')}`;
  }
  
  // Fallback
  return `users/${userId}/files/${uuid}.${getFileExtension(filename || '')}`;
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

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
