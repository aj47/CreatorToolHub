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

export interface UserImage {
  id: string;
  user_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  r2_key: string;
  image_type: 'frame' | 'reference';
  hash?: string;
  created_at: string;
  url?: string; // Generated signed URL for frontend
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

export interface UploadImageRequest {
  image_type: 'frame' | 'reference';
  file: File;
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

export interface UserImageRow {
  id: string;
  user_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  r2_key: string;
  image_type: string;
  hash: string | null;
  created_at: string;
}

export interface UserSettingsRow {
  user_id: string;
  favorites: string; // JSON string
  show_only_favs: number; // SQLite boolean as integer
  created_at: string;
  updated_at: string;
}
