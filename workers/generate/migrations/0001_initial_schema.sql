-- Initial schema for Creator Tool Hub user data storage
-- Migration: 0001_initial_schema.sql

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- derived from email hash for consistency
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User templates (custom presets)
CREATE TABLE user_templates (
  id TEXT PRIMARY KEY,           -- UUID
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  colors TEXT,                   -- JSON array of color strings
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Reference images stored in R2
CREATE TABLE reference_images (
  id TEXT PRIMARY KEY,           -- UUID
  template_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  r2_key TEXT NOT NULL,         -- R2 object key
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES user_templates (id) ON DELETE CASCADE
);

-- User uploaded images (frames/reference images)
CREATE TABLE user_images (
  id TEXT PRIMARY KEY,           -- UUID
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  r2_key TEXT NOT NULL,         -- R2 object key
  image_type TEXT NOT NULL,     -- 'frame' or 'reference'
  hash TEXT,                    -- SHA-256 hash for deduplication
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- User settings/preferences
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY,
  favorites TEXT,               -- JSON object of favorite template IDs
  show_only_favs BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX idx_user_templates_user_id ON user_templates (user_id);
CREATE INDEX idx_reference_images_template_id ON reference_images (template_id);
CREATE INDEX idx_user_images_user_id ON user_images (user_id);
CREATE INDEX idx_user_images_type ON user_images (user_id, image_type);
CREATE INDEX idx_user_images_hash ON user_images (hash);
