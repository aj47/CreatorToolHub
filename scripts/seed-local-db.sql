-- Database seeding script for local development
-- Populates the local D1 database with test data for past generations
-- Run with: cd workers/generate && npx wrangler d1 execute creator-tool-hub-db --local --file ../../scripts/seed-local-db.sql

-- Test user data (matches development mode user)
INSERT OR REPLACE INTO users (id, email, name, picture, created_at, updated_at) VALUES
('u-dev-example-com', 'dev@example.com', 'Dev User', '', datetime('now'), datetime('now'));

-- Sample user templates
INSERT OR REPLACE INTO user_templates (id, user_id, title, prompt, colors, created_at, updated_at) VALUES
('template-1', 'u-dev-example-com', 'Gaming Thumbnail', 'Create a vibrant gaming thumbnail with neon colors and futuristic elements', '["#ff0080", "#00ff80", "#8000ff"]', datetime('now', '-7 days'), datetime('now', '-7 days')),
('template-2', 'u-dev-example-com', 'Cooking Tutorial', 'Design a cooking tutorial thumbnail with warm colors and appetizing food', '["#ff6b35", "#f7931e", "#ffd23f"]', datetime('now', '-5 days'), datetime('now', '-5 days')),
('template-3', 'u-dev-example-com', 'Tech Review', 'Tech review thumbnail with clean modern design and product showcase', '["#2196f3", "#607d8b", "#9e9e9e"]', datetime('now', '-3 days'), datetime('now', '-3 days'));

-- Sample generations (past thumbnail generations)
INSERT OR REPLACE INTO generations (id, user_id, template_id, prompt, variants_requested, status, source, created_at, updated_at) VALUES
('gen-1', 'u-dev-example-com', 'template-1', 'Create a vibrant gaming thumbnail with neon colors and futuristic elements', 3, 'complete', 'thumbnails', datetime('now', '-7 days'), datetime('now', '-7 days')),
('gen-2', 'u-dev-example-com', 'template-2', 'Design a cooking tutorial thumbnail with warm colors and appetizing food', 4, 'complete', 'thumbnails', datetime('now', '-5 days'), datetime('now', '-5 days')),
('gen-3', 'u-dev-example-com', 'template-3', 'Tech review thumbnail with clean modern design and product showcase', 2, 'complete', 'thumbnails', datetime('now', '-3 days'), datetime('now', '-3 days')),
('gen-4', 'u-dev-example-com', NULL, 'Travel vlog thumbnail featuring beautiful landscape and adventure theme', 3, 'complete', 'thumbnails', datetime('now', '-2 days'), datetime('now', '-2 days')),
('gen-5', 'u-dev-example-com', NULL, 'Fitness workout thumbnail with energetic colors and motivational text', 4, 'complete', 'thumbnails', datetime('now', '-1 days'), datetime('now', '-1 days')),
('gen-6', 'u-dev-example-com', NULL, 'Educational content thumbnail with professional layout and clear typography', 2, 'complete', 'thumbnails', datetime('now', '-12 hours'), datetime('now', '-12 hours')),
('gen-7', 'u-dev-example-com', NULL, 'Music video thumbnail with artistic design and vibrant color palette', 3, 'complete', 'thumbnails', datetime('now', '-6 hours'), datetime('now', '-6 hours')),
('gen-8', 'u-dev-example-com', NULL, 'DIY craft tutorial thumbnail with bright colors and creative elements', 3, 'complete', 'thumbnails', datetime('now', '-2 hours'), datetime('now', '-2 hours'));

-- Sample generation outputs (mock thumbnail images using placeholder service)
-- Generation 1 outputs (3 variants)
INSERT OR REPLACE INTO generation_outputs (id, generation_id, variant_index, r2_key, mime_type, width, height, size_bytes, hash, created_at) VALUES 
('out-1-1', 'gen-1', 0, 'mock/gaming-thumb-1.jpg', 'image/jpeg', 1280, 720, 150000, 'hash1', datetime('now', '-7 days')),
('out-1-2', 'gen-1', 1, 'mock/gaming-thumb-2.jpg', 'image/jpeg', 1280, 720, 145000, 'hash2', datetime('now', '-7 days')),
('out-1-3', 'gen-1', 2, 'mock/gaming-thumb-3.jpg', 'image/jpeg', 1280, 720, 155000, 'hash3', datetime('now', '-7 days'));

-- Generation 2 outputs (4 variants)
INSERT OR REPLACE INTO generation_outputs (id, generation_id, variant_index, r2_key, mime_type, width, height, size_bytes, hash, created_at) VALUES 
('out-2-1', 'gen-2', 0, 'mock/cooking-thumb-1.jpg', 'image/jpeg', 1280, 720, 160000, 'hash4', datetime('now', '-5 days')),
('out-2-2', 'gen-2', 1, 'mock/cooking-thumb-2.jpg', 'image/jpeg', 1280, 720, 158000, 'hash5', datetime('now', '-5 days')),
('out-2-3', 'gen-2', 2, 'mock/cooking-thumb-3.jpg', 'image/jpeg', 1280, 720, 162000, 'hash6', datetime('now', '-5 days')),
('out-2-4', 'gen-2', 3, 'mock/cooking-thumb-4.jpg', 'image/jpeg', 1280, 720, 159000, 'hash7', datetime('now', '-5 days'));

-- Generation 3 outputs (2 variants)
INSERT OR REPLACE INTO generation_outputs (id, generation_id, variant_index, r2_key, mime_type, width, height, size_bytes, hash, created_at) VALUES 
('out-3-1', 'gen-3', 0, 'mock/tech-thumb-1.jpg', 'image/jpeg', 1280, 720, 140000, 'hash8', datetime('now', '-3 days')),
('out-3-2', 'gen-3', 1, 'mock/tech-thumb-2.jpg', 'image/jpeg', 1280, 720, 142000, 'hash9', datetime('now', '-3 days'));

-- Generation 4 outputs (3 variants)
INSERT OR REPLACE INTO generation_outputs (id, generation_id, variant_index, r2_key, mime_type, width, height, size_bytes, hash, created_at) VALUES 
('out-4-1', 'gen-4', 0, 'mock/travel-thumb-1.jpg', 'image/jpeg', 1280, 720, 165000, 'hash10', datetime('now', '-2 days')),
('out-4-2', 'gen-4', 1, 'mock/travel-thumb-2.jpg', 'image/jpeg', 1280, 720, 168000, 'hash11', datetime('now', '-2 days')),
('out-4-3', 'gen-4', 2, 'mock/travel-thumb-3.jpg', 'image/jpeg', 1280, 720, 163000, 'hash12', datetime('now', '-2 days'));

-- Generation 5 outputs (4 variants)
INSERT OR REPLACE INTO generation_outputs (id, generation_id, variant_index, r2_key, mime_type, width, height, size_bytes, hash, created_at) VALUES 
('out-5-1', 'gen-5', 0, 'mock/fitness-thumb-1.jpg', 'image/jpeg', 1280, 720, 170000, 'hash13', datetime('now', '-1 days')),
('out-5-2', 'gen-5', 1, 'mock/fitness-thumb-2.jpg', 'image/jpeg', 1280, 720, 172000, 'hash14', datetime('now', '-1 days')),
('out-5-3', 'gen-5', 2, 'mock/fitness-thumb-3.jpg', 'image/jpeg', 1280, 720, 169000, 'hash15', datetime('now', '-1 days')),
('out-5-4', 'gen-5', 3, 'mock/fitness-thumb-4.jpg', 'image/jpeg', 1280, 720, 171000, 'hash16', datetime('now', '-1 days'));

-- Generation 6 outputs (2 variants)
INSERT OR REPLACE INTO generation_outputs (id, generation_id, variant_index, r2_key, mime_type, width, height, size_bytes, hash, created_at) VALUES 
('out-6-1', 'gen-6', 0, 'mock/education-thumb-1.jpg', 'image/jpeg', 1280, 720, 135000, 'hash17', datetime('now', '-12 hours')),
('out-6-2', 'gen-6', 1, 'mock/education-thumb-2.jpg', 'image/jpeg', 1280, 720, 138000, 'hash18', datetime('now', '-12 hours'));

-- Generation 7 outputs (3 variants)
INSERT OR REPLACE INTO generation_outputs (id, generation_id, variant_index, r2_key, mime_type, width, height, size_bytes, hash, created_at) VALUES 
('out-7-1', 'gen-7', 0, 'mock/music-thumb-1.jpg', 'image/jpeg', 1280, 720, 175000, 'hash19', datetime('now', '-6 hours')),
('out-7-2', 'gen-7', 1, 'mock/music-thumb-2.jpg', 'image/jpeg', 1280, 720, 178000, 'hash20', datetime('now', '-6 hours')),
('out-7-3', 'gen-7', 2, 'mock/music-thumb-3.jpg', 'image/jpeg', 1280, 720, 173000, 'hash21', datetime('now', '-6 hours'));

-- Generation 8 outputs (3 variants)
INSERT OR REPLACE INTO generation_outputs (id, generation_id, variant_index, r2_key, mime_type, width, height, size_bytes, hash, created_at) VALUES 
('out-8-1', 'gen-8', 0, 'mock/diy-thumb-1.jpg', 'image/jpeg', 1280, 720, 180000, 'hash22', datetime('now', '-2 hours')),
('out-8-2', 'gen-8', 1, 'mock/diy-thumb-2.jpg', 'image/jpeg', 1280, 720, 182000, 'hash23', datetime('now', '-2 hours')),
('out-8-3', 'gen-8', 2, 'mock/diy-thumb-3.jpg', 'image/jpeg', 1280, 720, 179000, 'hash24', datetime('now', '-2 hours'));

-- User settings
INSERT OR REPLACE INTO user_settings (user_id, favorites, show_only_favs, created_at, updated_at) VALUES
('u-dev-example-com', '{"template-1": true, "template-3": true}', 0, datetime('now', '-7 days'), datetime('now', '-1 days'));
