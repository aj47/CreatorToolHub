// Type definitions for user data storage

export interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  created_at: string;
  updated_at: string;
}

export interface UserTemplate {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  colors: string[]; // Will be stored as JSON string in DB
  created_at: string;
  updated_at: string;
  reference_images?: ReferenceImage[]; // Populated via JOIN
}

export interface ReferenceImage {
  id: string;
  template_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  r2_key: string;
  created_at: string;
  url?: string; // Generated signed URL for frontend
}

export type GenerationStatus = 'pending' | 'running' | 'complete' | 'failed' | 'archived';

export interface Generation {
  id: string;
  user_id: string;
  template_id?: string;
  prompt: string;
  variants_requested: number;
  status: GenerationStatus;
  source?: string;
  parent_generation_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface GenerationOutput {
  id: string;
  generation_id: string;
  variant_index: number;
  r2_key: string;
  mime_type: string;
  width?: number;
  height?: number;
  size_bytes?: number;
  hash?: string;
  created_at: string;
  url?: string; // Generated signed URL for frontend
}

export interface GenerationInput {
  id: string;
  generation_id: string;
  input_type: string;
  source_id?: string;
  r2_key?: string;
  hash?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  favorites: Record<string, boolean>; // Will be stored as JSON string in DB
  show_only_favs: boolean;
  created_at: string;
  updated_at: string;
}

// API request/response types
export interface CreateTemplateRequest {
  title: string;
  prompt: string;
  colors: string[];
  reference_images?: File[]; // For multipart uploads
}

export interface UpdateTemplateRequest {
  title?: string;
  prompt?: string;
  colors?: string[];
}

export interface CreateGenerationRequest {
  template_id?: string;
  prompt: string;
  variants_requested?: number;
  source?: string;
  parent_generation_id?: string;
  inputs?: Array<{
    input_type: string;
    source_id?: string;
    r2_key?: string;
    hash?: string;
    metadata?: Record<string, any>;
  }>;
}

export interface RecordGenerationOutputsRequest {
  outputs: Array<{
    variant_index: number;
    r2_key: string;
    mime_type: string;
    width?: number;
    height?: number;
    size_bytes?: number;
    hash?: string;
  }>;
}

export interface UpdateSettingsRequest {
  favorites?: Record<string, boolean>;
  show_only_favs?: boolean;
}

// Database row types (as returned from D1)
export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserTemplateRow {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  colors: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface ReferenceImageRow {
  id: string;
  template_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  r2_key: string;
  created_at: string;
}

export interface GenerationRow {
  id: string;
  user_id: string;
  template_id: string | null;
  prompt: string;
  variants_requested: number;
  status: string;
  source: string | null;
  parent_generation_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerationOutputRow {
  id: string;
  generation_id: string;
  variant_index: number;
  r2_key: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  hash: string | null;
  created_at: string;
}

export interface GenerationInputRow {
  id: string;
  generation_id: string;
  input_type: string;
  source_id: string | null;
  r2_key: string | null;
  hash: string | null;
  metadata: string | null;
  created_at: string;
}

export interface UserSettingsRow {
  user_id: string;
  favorites: string; // JSON string
  show_only_favs: number; // SQLite boolean as integer
  created_at: string;
  updated_at: string;
}
