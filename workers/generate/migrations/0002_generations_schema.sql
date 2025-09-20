-- Migration: 0002_generations_schema.sql
-- Purpose: pivot storage from user image persistence to generation-first model

-- Drop legacy user_images table and associated indexes if they exist
DROP INDEX IF EXISTS idx_user_images_hash;
DROP INDEX IF EXISTS idx_user_images_type;
DROP INDEX IF EXISTS idx_user_images_user_id;
DROP TABLE IF EXISTS user_images;

-- Create generations table to capture generation requests and lifecycle
CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template_id TEXT,
  prompt TEXT NOT NULL,
  variants_requested INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT,
  parent_generation_id TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES user_templates (id) ON DELETE SET NULL,
  FOREIGN KEY (parent_generation_id) REFERENCES generations (id) ON DELETE SET NULL
);

CREATE INDEX idx_generations_user_id_created_at ON generations (user_id, created_at DESC);
CREATE INDEX idx_generations_template_id ON generations (template_id);
CREATE INDEX idx_generations_parent_id ON generations (parent_generation_id);

-- Create generation_outputs table to track assets stored in R2
CREATE TABLE generation_outputs (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL,
  variant_index INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (generation_id) REFERENCES generations (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_generation_outputs_variant ON generation_outputs (generation_id, variant_index);
CREATE INDEX idx_generation_outputs_hash ON generation_outputs (hash);

-- Optional: capture inputs (frames, references, etc.) used for a generation
CREATE TABLE generation_inputs (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL,
  input_type TEXT NOT NULL,
  source_id TEXT,
  r2_key TEXT,
  hash TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (generation_id) REFERENCES generations (id) ON DELETE CASCADE
);

CREATE INDEX idx_generation_inputs_generation_id ON generation_inputs (generation_id);

