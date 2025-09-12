// Database operations for user data storage
import { 
  User, UserTemplate, UserSettings, ReferenceImage, UserImage,
  UserRow, UserTemplateRow, UserSettingsRow, ReferenceImageRow, UserImageRow
} from './types';
import { 
  deriveUserId, generateUUID, getCurrentTimestamp, 
  convertUserTemplateRow, convertUserSettingsRow 
} from './utils';

export class DatabaseService {
  constructor(private db: D1Database) {}

  // User operations
  async createOrUpdateUser(email: string, name?: string, picture?: string): Promise<User> {
    const userId = deriveUserId(email);
    const now = getCurrentTimestamp();
    
    // Try to update first, then insert if not exists
    const updateResult = await this.db.prepare(`
      UPDATE users 
      SET name = ?, picture = ?, updated_at = ?
      WHERE id = ?
    `).bind(name || null, picture || null, now, userId).run();
    
    if (updateResult.changes === 0) {
      // User doesn't exist, create new
      await this.db.prepare(`
        INSERT INTO users (id, email, name, picture, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(userId, email, name || null, picture || null, now, now).run();
    }
    
    return {
      id: userId,
      email,
      name: name || '',
      picture: picture || '',
      created_at: now,
      updated_at: now
    };
  }

  async getUser(userId: string): Promise<User | null> {
    const result = await this.db.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(userId).first<UserRow>();
    
    if (!result) return null;
    
    return {
      id: result.id,
      email: result.email,
      name: result.name || '',
      picture: result.picture || '',
      created_at: result.created_at,
      updated_at: result.updated_at
    };
  }

  // Template operations
  async createTemplate(userId: string, title: string, prompt: string, colors: string[]): Promise<UserTemplate> {
    const templateId = generateUUID();
    const now = getCurrentTimestamp();
    
    await this.db.prepare(`
      INSERT INTO user_templates (id, user_id, title, prompt, colors, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(templateId, userId, title, prompt, JSON.stringify(colors), now, now).run();
    
    return {
      id: templateId,
      user_id: userId,
      title,
      prompt,
      colors,
      created_at: now,
      updated_at: now
    };
  }

  async getTemplates(userId: string): Promise<UserTemplate[]> {
    const results = await this.db.prepare(`
      SELECT * FROM user_templates 
      WHERE user_id = ? 
      ORDER BY updated_at DESC
    `).bind(userId).all<UserTemplateRow>();
    
    return results.results.map(convertUserTemplateRow);
  }

  async getTemplate(templateId: string, userId: string): Promise<UserTemplate | null> {
    const result = await this.db.prepare(`
      SELECT * FROM user_templates 
      WHERE id = ? AND user_id = ?
    `).bind(templateId, userId).first<UserTemplateRow>();
    
    if (!result) return null;
    return convertUserTemplateRow(result);
  }

  async updateTemplate(templateId: string, userId: string, updates: Partial<UserTemplate>): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.prompt !== undefined) {
      fields.push('prompt = ?');
      values.push(updates.prompt);
    }
    if (updates.colors !== undefined) {
      fields.push('colors = ?');
      values.push(JSON.stringify(updates.colors));
    }
    
    if (fields.length === 0) return false;
    
    fields.push('updated_at = ?');
    values.push(getCurrentTimestamp());
    values.push(templateId, userId);
    
    const result = await this.db.prepare(`
      UPDATE user_templates 
      SET ${fields.join(', ')}
      WHERE id = ? AND user_id = ?
    `).bind(...values).run();
    
    return result.changes > 0;
  }

  async deleteTemplate(templateId: string, userId: string): Promise<boolean> {
    const result = await this.db.prepare(`
      DELETE FROM user_templates 
      WHERE id = ? AND user_id = ?
    `).bind(templateId, userId).run();
    
    return result.changes > 0;
  }

  // Reference image operations
  async createReferenceImage(templateId: string, filename: string, contentType: string, sizeBytes: number, r2Key: string): Promise<ReferenceImage> {
    const imageId = generateUUID();
    const now = getCurrentTimestamp();
    
    await this.db.prepare(`
      INSERT INTO reference_images (id, template_id, filename, content_type, size_bytes, r2_key, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(imageId, templateId, filename, contentType, sizeBytes, r2Key, now).run();
    
    return {
      id: imageId,
      template_id: templateId,
      filename,
      content_type: contentType,
      size_bytes: sizeBytes,
      r2_key: r2Key,
      created_at: now
    };
  }

  async getReferenceImages(templateId: string): Promise<ReferenceImage[]> {
    const results = await this.db.prepare(`
      SELECT * FROM reference_images 
      WHERE template_id = ? 
      ORDER BY created_at ASC
    `).bind(templateId).all<ReferenceImageRow>();
    
    return results.results.map(row => ({
      id: row.id,
      template_id: row.template_id,
      filename: row.filename,
      content_type: row.content_type,
      size_bytes: row.size_bytes,
      r2_key: row.r2_key,
      created_at: row.created_at
    }));
  }

  async deleteReferenceImage(imageId: string): Promise<string | null> {
    // Get R2 key before deleting
    const image = await this.db.prepare(`
      SELECT r2_key FROM reference_images WHERE id = ?
    `).bind(imageId).first<{ r2_key: string }>();

    if (!image) return null;

    await this.db.prepare(`
      DELETE FROM reference_images WHERE id = ?
    `).bind(imageId).run();

    return image.r2_key;
  }

  // User image operations
  async createUserImage(userId: string, filename: string, contentType: string, sizeBytes: number, r2Key: string, imageType: 'frame' | 'reference', hash?: string): Promise<UserImage> {
    const imageId = generateUUID();
    const now = getCurrentTimestamp();

    await this.db.prepare(`
      INSERT INTO user_images (id, user_id, filename, content_type, size_bytes, r2_key, image_type, hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(imageId, userId, filename, contentType, sizeBytes, r2Key, imageType, hash || null, now).run();

    return {
      id: imageId,
      user_id: userId,
      filename,
      content_type: contentType,
      size_bytes: sizeBytes,
      r2_key: r2Key,
      image_type: imageType,
      hash,
      created_at: now
    };
  }

  async getUserImages(userId: string, imageType?: 'frame' | 'reference'): Promise<UserImage[]> {
    let query = `SELECT * FROM user_images WHERE user_id = ?`;
    const params = [userId];

    if (imageType) {
      query += ` AND image_type = ?`;
      params.push(imageType);
    }

    query += ` ORDER BY created_at DESC`;

    const results = await this.db.prepare(query).bind(...params).all<UserImageRow>();

    return results.results.map(row => ({
      id: row.id,
      user_id: row.user_id,
      filename: row.filename,
      content_type: row.content_type,
      size_bytes: row.size_bytes,
      r2_key: row.r2_key,
      image_type: row.image_type as 'frame' | 'reference',
      hash: row.hash || undefined,
      created_at: row.created_at
    }));
  }

  async deleteUserImage(imageId: string, userId: string): Promise<string | null> {
    // Get R2 key before deleting
    const image = await this.db.prepare(`
      SELECT r2_key FROM user_images WHERE id = ? AND user_id = ?
    `).bind(imageId, userId).first<{ r2_key: string }>();

    if (!image) return null;

    await this.db.prepare(`
      DELETE FROM user_images WHERE id = ? AND user_id = ?
    `).bind(imageId, userId).run();

    return image.r2_key;
  }

  async findImageByHash(userId: string, hash: string): Promise<UserImage | null> {
    const result = await this.db.prepare(`
      SELECT * FROM user_images WHERE user_id = ? AND hash = ? LIMIT 1
    `).bind(userId, hash).first<UserImageRow>();

    if (!result) return null;

    return {
      id: result.id,
      user_id: result.user_id,
      filename: result.filename,
      content_type: result.content_type,
      size_bytes: result.size_bytes,
      r2_key: result.r2_key,
      image_type: result.image_type as 'frame' | 'reference',
      hash: result.hash || undefined,
      created_at: result.created_at
    };
  }

  // User settings operations
  async createOrUpdateSettings(userId: string, favorites?: Record<string, boolean>, showOnlyFavs?: boolean): Promise<UserSettings> {
    const now = getCurrentTimestamp();

    // Try to update first
    const updateResult = await this.db.prepare(`
      UPDATE user_settings
      SET favorites = COALESCE(?, favorites),
          show_only_favs = COALESCE(?, show_only_favs),
          updated_at = ?
      WHERE user_id = ?
    `).bind(
      favorites ? JSON.stringify(favorites) : null,
      showOnlyFavs !== undefined ? (showOnlyFavs ? 1 : 0) : null,
      now,
      userId
    ).run();

    if (updateResult.changes === 0) {
      // Settings don't exist, create new
      await this.db.prepare(`
        INSERT INTO user_settings (user_id, favorites, show_only_favs, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        userId,
        JSON.stringify(favorites || {}),
        showOnlyFavs ? 1 : 0,
        now,
        now
      ).run();
    }

    return {
      user_id: userId,
      favorites: favorites || {},
      show_only_favs: showOnlyFavs || false,
      created_at: now,
      updated_at: now
    };
  }

  async getSettings(userId: string): Promise<UserSettings | null> {
    const result = await this.db.prepare(`
      SELECT * FROM user_settings WHERE user_id = ?
    `).bind(userId).first<UserSettingsRow>();

    if (!result) return null;
    return convertUserSettingsRow(result);
  }
}
