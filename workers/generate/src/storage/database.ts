// Database operations for user data storage
import {
  User,
  UserTemplate,
  UserSettings,
  ReferenceImage,
  Generation,
  GenerationStatus,
  GenerationOutput,
  GenerationInput,
  UserRow,
  UserTemplateRow,
  UserSettingsRow,
  ReferenceImageRow,
  GenerationRow,
  GenerationOutputRow,
  GenerationInputRow
} from './types';
import {
  deriveUserId,
  generateUUID,
  getCurrentTimestamp,
  convertUserTemplateRow,
  convertUserSettingsRow,
  convertGenerationRow,
  convertGenerationOutputRow,
  convertGenerationInputRow
} from './utils';

export class DatabaseService {
  constructor(private db: any) {}

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
      try {
        await this.db.prepare(`
          INSERT INTO users (id, email, name, picture, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(userId, email, name || null, picture || null, now, now).run();
      } catch (error: any) {
        // Handle race condition where user was created between UPDATE and INSERT
        if (error?.message?.includes('UNIQUE constraint failed')) {
          console.log(`User ${userId} already exists, continuing...`);
        } else {
          throw error;
        }
      }
    }

    // Verify user exists after creation/update (handle D1 eventual consistency)
    await this.ensureUserExists(userId, email, name, picture);

    return {
      id: userId,
      email,
      name: name || '',
      picture: picture || '',
      created_at: now,
      updated_at: now
    };
  }

  /**
   * Ensure user exists in database with retry logic for D1 eventual consistency
   */
  private async ensureUserExists(userId: string, email: string, name?: string, picture?: string, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const user = await this.getUser(userId);
      if (user) {
        return; // User exists, we're good
      }

      if (attempt === maxRetries) {
        // Final attempt - try to create user one more time
        try {
          const now = getCurrentTimestamp();
          await this.db.prepare(`
            INSERT OR IGNORE INTO users (id, email, name, picture, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(userId, email, name || null, picture || null, now, now).run();
        } catch (error) {
          console.error(`Failed to ensure user ${userId} exists after ${maxRetries} attempts:`, error);
          throw new Error(`User creation failed after ${maxRetries} attempts. This may be due to database consistency issues.`);
        }
      } else {
        // Wait before retry (exponential backoff)
        const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000); // 100ms, 200ms, 400ms, max 1s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async getUser(userId: string): Promise<User | null> {
    const result = await this.db.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(userId).first();
    
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

    try {
      await this.db.prepare(`
        INSERT INTO user_templates (id, user_id, title, prompt, colors, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(templateId, userId, title, prompt, JSON.stringify(colors), now, now).run();
    } catch (error: any) {
      // Handle foreign key constraint errors
      if (error?.message?.includes('FOREIGN KEY constraint failed')) {
        throw new Error(`User with ID ${userId} not found`);
      }
      throw error;
    }

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
    `).bind(userId).all();
    
    return results.results.map(convertUserTemplateRow);
  }

  async getTemplate(templateId: string, userId: string): Promise<UserTemplate | null> {
    const result = await this.db.prepare(`
      SELECT * FROM user_templates 
      WHERE id = ? AND user_id = ?
    `).bind(templateId, userId).first();
    
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

    try {
      await this.db.prepare(`
        INSERT INTO reference_images (id, template_id, filename, content_type, size_bytes, r2_key, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(imageId, templateId, filename, contentType, sizeBytes, r2Key, now).run();
    } catch (error: any) {
      // Handle foreign key constraint errors
      if (error?.message?.includes('FOREIGN KEY constraint failed')) {
        throw new Error(`Template with ID ${templateId} not found`);
      }
      throw error;
    }

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
    `).bind(templateId).all();
    
    return results.results.map((row: any) => ({
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
    `).bind(imageId).first();

    if (!image) return null;

    await this.db.prepare(`
      DELETE FROM reference_images WHERE id = ?
    `).bind(imageId).run();

    return image.r2_key;
  }

  // Generation operations
  async createGeneration(
    userId: string,
    params: {
      templateId?: string;
      prompt: string;
      variantsRequested?: number;
      status?: GenerationStatus;
      source?: string;
      parentGenerationId?: string;
    }
  ): Promise<Generation> {
    const generationId = generateUUID();
    const now = getCurrentTimestamp();
    const status = params.status || 'pending';
    const variantsRequested = params.variantsRequested ?? 1;

    // Retry logic for D1 eventual consistency
    let lastError: any = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.db.prepare(`
          INSERT INTO generations (id, user_id, template_id, prompt, variants_requested, status, source, parent_generation_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          generationId,
          userId,
          params.templateId || null,
          params.prompt,
          variantsRequested,
          status,
          params.source || null,
          params.parentGenerationId || null,
          now,
          now
        ).run();

        console.log(`Generation INSERT successful: ${generationId} for user ${userId}`);
        // Success - break out of retry loop
        break;

      } catch (error: any) {
        lastError = error;
        console.error(`Generation INSERT attempt ${attempt} failed:`, error?.message);

        // Handle foreign key constraint errors
        if (error?.message?.includes('FOREIGN KEY constraint failed')) {
          if (params.templateId) {
            // Template not found - don't retry
            throw new Error(`Template with ID ${params.templateId} not found or access denied`);
          }
          if (params.parentGenerationId) {
            // Parent generation not found - don't retry
            throw new Error(`Parent generation with ID ${params.parentGenerationId} not found or access denied`);
          }

          // User not found - might be eventual consistency issue
          if (attempt < maxRetries) {
            console.log(`Attempt ${attempt}: User ${userId} not found, retrying...`);
            // Wait before retry (exponential backoff)
            const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            // Final attempt failed
            throw new Error(`User with ID ${userId} not found`);
          }
        }

        // Other errors - don't retry
        throw error;
      }
    }

    // Retry SELECT to handle D1 eventual consistency
    let row = null;
    for (let selectAttempt = 1; selectAttempt <= 3; selectAttempt++) {
      try {
        row = await this.db.prepare(`
          SELECT * FROM generations WHERE id = ?
        `).bind(generationId).first();

        if (row) {
          console.log(`Generation SELECT successful on attempt ${selectAttempt}: ${generationId}`);
          break;
        }

        if (selectAttempt < 3) {
          console.log(`SELECT attempt ${selectAttempt}: Generation ${generationId} not found, retrying...`);
          const delay = Math.min(100 * Math.pow(2, selectAttempt - 1), 1000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (selectError) {
        console.error(`SELECT attempt ${selectAttempt} error:`, selectError);
        if (selectAttempt === 3) {
          throw selectError;
        }
      }
    }

    if (!row) {
      console.error(`Failed to load generation after insert - eventual consistency timeout for ${generationId}`);
      throw new Error('Failed to load generation after insert - eventual consistency timeout');
    }

    return convertGenerationRow(row as GenerationRow);
  }

  async addGenerationInputs(
    generationId: string,
    inputs: Array<{
      input_type: string;
      source_id?: string;
      r2_key?: string;
      hash?: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<GenerationInput[]> {
    if (!inputs || inputs.length === 0) {
      return [];
    }

    const created: GenerationInput[] = [];

    for (const input of inputs) {
      const id = generateUUID();
      const createdAt = getCurrentTimestamp();
      const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

      await this.db.prepare(`
        INSERT INTO generation_inputs (id, generation_id, input_type, source_id, r2_key, hash, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        generationId,
        input.input_type,
        input.source_id || null,
        input.r2_key || null,
        input.hash || null,
        metadata,
        createdAt
      ).run();

      created.push(
        convertGenerationInputRow({
          id,
          generation_id: generationId,
          input_type: input.input_type,
          source_id: input.source_id || null,
          r2_key: input.r2_key || null,
          hash: input.hash || null,
          metadata,
          created_at: createdAt
        } as GenerationInputRow)
      );
    }

    return created;
  }

  async addGenerationOutputs(
    generationId: string,
    outputs: Array<{
      variant_index: number;
      r2_key: string;
      mime_type: string;
      width?: number;
      height?: number;
      size_bytes?: number;
      hash?: string;
    }>
  ): Promise<GenerationOutput[]> {
    if (!outputs || outputs.length === 0) {
      return [];
    }

    const created: GenerationOutput[] = [];

    for (const output of outputs) {
      const id = generateUUID();
      const createdAt = getCurrentTimestamp();

      await this.db.prepare(`
        INSERT INTO generation_outputs (id, generation_id, variant_index, r2_key, mime_type, width, height, size_bytes, hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        generationId,
        output.variant_index,
        output.r2_key,
        output.mime_type,
        output.width ?? null,
        output.height ?? null,
        output.size_bytes ?? null,
        output.hash || null,
        createdAt
      ).run();

      created.push(
        convertGenerationOutputRow({
          id,
          generation_id: generationId,
          variant_index: output.variant_index,
          r2_key: output.r2_key,
          mime_type: output.mime_type,
          width: output.width ?? null,
          height: output.height ?? null,
          size_bytes: output.size_bytes ?? null,
          hash: output.hash || null,
          created_at: createdAt
        } as GenerationOutputRow)
      );
    }

    return created;
  }

  async getGenerations(
    userId: string,
    options: { limit?: number; before?: string } = {}
  ): Promise<Generation[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
    let query = `
      SELECT * FROM generations
      WHERE user_id = ?
    `;
    const params: any[] = [userId];

    if (options.before) {
      query += ` AND created_at < ?`;
      params.push(options.before);
    }

    query += ` ORDER BY created_at DESC, id DESC LIMIT ?`;
    params.push(limit);

    const results = await this.db.prepare(query).bind(...params).all();
    const rows = results.results || [];
    return rows.map((row: GenerationRow) => convertGenerationRow(row));
  }

  async getGeneration(generationId: string, userId: string): Promise<Generation | null> {
    const row = await this.db.prepare(`
      SELECT * FROM generations WHERE id = ? AND user_id = ? LIMIT 1
    `).bind(generationId, userId).first();

    if (!row) {
      return null;
    }

    return convertGenerationRow(row as GenerationRow);
  }

  async getGenerationOutputs(generationId: string): Promise<GenerationOutput[]> {
    const results = await this.db.prepare(`
      SELECT * FROM generation_outputs WHERE generation_id = ? ORDER BY variant_index ASC
    `).bind(generationId).all();

    const rows = results.results || [];
    return rows.map((row: GenerationOutputRow) => convertGenerationOutputRow(row));
  }

  async getGenerationInputs(generationId: string): Promise<GenerationInput[]> {
    const results = await this.db.prepare(`
      SELECT * FROM generation_inputs WHERE generation_id = ? ORDER BY created_at ASC
    `).bind(generationId).all();

    const rows = results.results || [];
    return rows.map((row: GenerationInputRow) => convertGenerationInputRow(row));
  }

  async updateGeneration(
    generationId: string,
    userId: string,
    updates: {
      status?: GenerationStatus;
      error_message?: string | null;
      prompt?: string;
      templateId?: string | null;
      variantsRequested?: number;
      source?: string | null;
      parentGenerationId?: string | null;
    }
  ): Promise<Generation | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.error_message !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.error_message || null);
    }
    if (updates.prompt !== undefined) {
      fields.push('prompt = ?');
      values.push(updates.prompt);
    }
    if (updates.templateId !== undefined) {
      fields.push('template_id = ?');
      values.push(updates.templateId || null);
    }
    if (updates.variantsRequested !== undefined) {
      fields.push('variants_requested = ?');
      values.push(updates.variantsRequested);
    }
    if (updates.source !== undefined) {
      fields.push('source = ?');
      values.push(updates.source || null);
    }
    if (updates.parentGenerationId !== undefined) {
      fields.push('parent_generation_id = ?');
      values.push(updates.parentGenerationId || null);
    }

    if (fields.length === 0) {
      return await this.getGeneration(generationId, userId);
    }

    const updatedAt = getCurrentTimestamp();
    fields.push('updated_at = ?');
    values.push(updatedAt);
    values.push(generationId, userId);

    const result = await this.db.prepare(`
      UPDATE generations
      SET ${fields.join(', ')}
      WHERE id = ? AND user_id = ?
    `).bind(...values).run();

    if (result.changes === 0) {
      return null;
    }

    return await this.getGeneration(generationId, userId);
  }

  async deleteGeneration(generationId: string, userId: string): Promise<boolean> {
    const result = await this.db.prepare(`
      DELETE FROM generations WHERE id = ? AND user_id = ?
    `).bind(generationId, userId).run();

    return result.changes > 0;
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
      try {
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
      } catch (error: any) {
        // Handle foreign key constraint errors
        if (error?.message?.includes('FOREIGN KEY constraint failed')) {
          throw new Error(`User with ID ${userId} not found`);
        }
        throw error;
      }
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
    `).bind(userId).first();

    if (!result) return null;
    return convertUserSettingsRow(result);
  }
}
