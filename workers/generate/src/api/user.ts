// User data API endpoints
import { DatabaseService } from '../storage/database';
import { R2StorageService } from '../storage/r2';
import { deriveUserId } from '../storage/utils';

// Auth helpers (mirrored from main app)
function getAuthToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
    const [key, ...rest] = cookie.trim().split("=");
    acc[key] = rest.join("=");
    return acc;
  }, {} as Record<string, string>);
  return cookies["auth-token"] || null;
}

function verifyAuthToken(token: string): { email: string; name?: string; picture?: string } | null {
  try {
    const payload = JSON.parse(atob(token));
    if (payload?.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload?.email) {
      return { email: payload.email, name: payload.name || "", picture: payload.picture || "" };
    }
    return null;
  } catch {
    return null;
  }
}

function getUser(request: Request): { email: string; name?: string; picture?: string } | null {
  const token = getAuthToken(request);
  if (!token) return null;
  return verifyAuthToken(token);
}

export class UserAPI {
  constructor(
    private db: DatabaseService,
    private r2: R2StorageService,
    private env: any
  ) {}

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Authentication check (bypass in development)
    let user = getUser(request);
    if (!user && this.env.NODE_ENV === 'development') {
      user = { email: 'dev@example.com', name: 'Dev User', picture: '' };
    }
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = deriveUserId(user.email);

    try {
      // Ensure user exists in database
      await this.db.createOrUpdateUser(user.email, user.name, user.picture);

      // Route to appropriate handler
      if (path === '/api/user/profile') {
        return this.handleProfile(request, userId, method);
      } else if (path === '/api/user/templates') {
        return this.handleTemplates(request, userId, method);
      } else if (path.startsWith('/api/user/templates/')) {
        const templateId = path.split('/')[4];
        return this.handleTemplate(request, userId, templateId, method);
      } else if (path === '/api/user/images') {
        return this.handleImages(request, userId, method);
      } else if (path.startsWith('/api/user/images/')) {
        const imageId = path.split('/')[4];
        return this.handleImage(request, userId, imageId, method);
      } else if (path === '/api/user/settings') {
        return this.handleSettings(request, userId, method);
      } else if (path === '/api/user/migrate') {
        return this.handleMigration(request, userId, method);
      }

      return new Response(JSON.stringify({ error: "Not found" }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('User API error:', error);
      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleProfile(request: Request, userId: string, method: string): Promise<Response> {
    if (method === 'GET') {
      const user = await this.db.getUser(userId);
      return new Response(JSON.stringify(user), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: "Method not allowed" }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleTemplates(request: Request, userId: string, method: string): Promise<Response> {
    if (method === 'GET') {
      const templates = await this.db.getTemplates(userId);
      
      // Add reference images to each template
      for (const template of templates) {
        const refImages = await this.db.getReferenceImages(template.id);
        // Generate signed URLs for reference images
        for (const img of refImages) {
          img.url = await this.r2.getSignedUrl(img.r2_key);
        }
        template.reference_images = refImages;
      }
      
      return new Response(JSON.stringify(templates), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (method === 'POST') {
      const data = await request.json();
      const { title, prompt, colors = [] } = data;
      
      if (!title || !prompt) {
        return new Response(JSON.stringify({ error: "Title and prompt are required" }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const template = await this.db.createTemplate(userId, title, prompt, colors);
      return new Response(JSON.stringify(template), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: "Method not allowed" }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleTemplate(request: Request, userId: string, templateId: string, method: string): Promise<Response> {
    if (method === 'GET') {
      const template = await this.db.getTemplate(templateId, userId);
      if (!template) {
        return new Response(JSON.stringify({ error: "Template not found" }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Add reference images
      const refImages = await this.db.getReferenceImages(template.id);
      for (const img of refImages) {
        img.url = await this.r2.getSignedUrl(img.r2_key);
      }
      template.reference_images = refImages;
      
      return new Response(JSON.stringify(template), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (method === 'PUT') {
      const data = await request.json();
      const updated = await this.db.updateTemplate(templateId, userId, data);
      
      if (!updated) {
        return new Response(JSON.stringify({ error: "Template not found" }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (method === 'DELETE') {
      // Delete reference images first
      const refImages = await this.db.getReferenceImages(templateId);
      for (const img of refImages) {
        await this.r2.deleteFile(img.r2_key);
        await this.db.deleteReferenceImage(img.id);
      }
      
      const deleted = await this.db.deleteTemplate(templateId, userId);
      if (!deleted) {
        return new Response(JSON.stringify({ error: "Template not found" }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleImages(request: Request, userId: string, method: string): Promise<Response> {
    if (method === 'GET') {
      const url = new URL(request.url);
      const imageType = url.searchParams.get('type') as 'frame' | 'reference' | null;

      const images = await this.db.getUserImages(userId, imageType || undefined);

      // Generate signed URLs
      for (const img of images) {
        img.url = await this.r2.getSignedUrl(img.r2_key);
      }

      return new Response(JSON.stringify(images), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const imageType = formData.get('image_type') as 'frame' | 'reference';

      if (!file || !imageType) {
        return new Response(JSON.stringify({ error: "File and image_type are required" }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check for duplicate by hash
      const buffer = await file.arrayBuffer();
      const hash = await this.calculateFileHash(buffer);
      const existing = await this.db.findImageByHash(userId, hash);

      if (existing) {
        // Return existing image
        existing.url = await this.r2.getSignedUrl(existing.r2_key);
        return new Response(JSON.stringify(existing), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Upload new file
      const { key } = await this.r2.uploadFile(userId, file, 'image', imageType);
      const image = await this.db.createUserImage(
        userId,
        file.name,
        file.type,
        file.size,
        key,
        imageType,
        hash
      );

      image.url = await this.r2.getSignedUrl(key);

      return new Response(JSON.stringify(image), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleImage(request: Request, userId: string, imageId: string, method: string): Promise<Response> {
    if (method === 'DELETE') {
      const r2Key = await this.db.deleteUserImage(imageId, userId);
      if (!r2Key) {
        return new Response(JSON.stringify({ error: "Image not found" }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await this.r2.deleteFile(r2Key);

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleSettings(request: Request, userId: string, method: string): Promise<Response> {
    if (method === 'GET') {
      const settings = await this.db.getSettings(userId);
      return new Response(JSON.stringify(settings || {
        user_id: userId,
        favorites: {},
        show_only_favs: false
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (method === 'PUT') {
      const data = await request.json();
      const { favorites, show_only_favs } = data;

      const settings = await this.db.createOrUpdateSettings(userId, favorites, show_only_favs);

      return new Response(JSON.stringify(settings), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleMigration(request: Request, userId: string, method: string): Promise<Response> {
    if (method !== 'POST') {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await request.json();
    const { templates, frames, refFrames, settings } = data;

    const results = {
      templates: 0,
      frames: 0,
      refFrames: 0,
      settings: false,
      errors: [] as string[]
    };

    try {
      // Migrate templates
      if (templates && typeof templates === 'object') {
        for (const [id, template] of Object.entries(templates)) {
          try {
            const t = template as any;
            await this.db.createTemplate(userId, t.title || 'Migrated Template', t.prompt || '', t.colors || []);
            results.templates++;
          } catch (error) {
            results.errors.push(`Template ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Migrate frames
      if (Array.isArray(frames)) {
        for (const frame of frames) {
          try {
            if (frame.dataUrl) {
              const { key, hash } = await this.r2.uploadFromDataUrl(
                userId,
                frame.dataUrl,
                frame.filename || 'migrated-frame.jpg',
                'image',
                'frame'
              );
              await this.db.createUserImage(
                userId,
                frame.filename || 'migrated-frame.jpg',
                'image/jpeg',
                0, // Size unknown from dataUrl
                key,
                'frame',
                hash
              );
              results.frames++;
            }
          } catch (error) {
            results.errors.push(`Frame: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Migrate reference frames
      if (Array.isArray(refFrames)) {
        for (const frame of refFrames) {
          try {
            if (frame.dataUrl) {
              const { key, hash } = await this.r2.uploadFromDataUrl(
                userId,
                frame.dataUrl,
                frame.filename || 'migrated-ref.jpg',
                'image',
                'reference'
              );
              await this.db.createUserImage(
                userId,
                frame.filename || 'migrated-ref.jpg',
                'image/jpeg',
                0,
                key,
                'reference',
                hash
              );
              results.refFrames++;
            }
          } catch (error) {
            results.errors.push(`Reference frame: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Migrate settings
      if (settings && typeof settings === 'object') {
        try {
          await this.db.createOrUpdateSettings(
            userId,
            settings.favorites || {},
            settings.show_only_favs || false
          );
          results.settings = true;
        } catch (error) {
          results.errors.push(`Settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Migration failed"
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async calculateFileHash(content: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', content);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
