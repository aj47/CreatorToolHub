-- Migration: Add model and template tracking columns to generations table
-- This allows tracking which AI model (provider) and template name was used for each generation

-- Add model column to store the provider/model used (e.g., 'gemini', 'fal-flux', 'fal-qwen')
ALTER TABLE generations ADD COLUMN model TEXT;

-- Add template_name column to store the human-readable template name for display
ALTER TABLE generations ADD COLUMN template_name TEXT;

-- Add refinement_prompt column to track refinement requests (for refinement generations)
ALTER TABLE generations ADD COLUMN refinement_prompt TEXT;

-- Create index for model-based queries
CREATE INDEX idx_generations_model ON generations (model);

