// User data API endpoints
import { DatabaseService } from '../storage/database';
import { R2StorageService } from '../storage/r2';
import { deriveUserId } from '../storage/utils';

// Helper to create JSON responses with no-cache headers to prevent stale data
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    }
  });
}

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
      return jsonResponse({ error: "Unauthorized" }, 401);
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
        const segments = path.split('/');
        const templateId = segments[4];
        return this.handleTemplate(request, userId, templateId, method);
      } else if (path === '/api/user/generations') {
        return this.handleGenerations(request, userId, method);
      } else if (path.startsWith('/api/user/generations/')) {
        const segments = path.split('/');
        const generationId = segments[4];
        const subresource = segments[5];
        if (!generationId) {
          return jsonResponse({ error: "Generation ID is required" }, 400);
        }
        if (subresource === 'outputs') {
          return this.handleGenerationOutputs(request, userId, generationId, method);
        }
        return this.handleGenerationDetail(request, userId, generationId, method);
      } else if (path === '/api/user/settings') {
        return this.handleSettings(request, userId, method);
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (error) {
      console.error('User API error:', error);
      return jsonResponse({
        error: error instanceof Error ? error.message : "Internal server error"
      }, 500);
    }
  }

  private async handleProfile(request: Request, userId: string, method: string): Promise<Response> {
    if (method === 'GET') {
      const user = await this.db.getUser(userId);
      return jsonResponse(user);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
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
      
      return jsonResponse(templates);
    }

    if (method === 'POST') {
      const data = await request.json();
      const { title, prompt, colors = [] } = data;

      if (!title || !prompt) {
        return jsonResponse({ error: "Title and prompt are required" }, 400);
      }

      const template = await this.db.createTemplate(userId, title, prompt, colors);
      return jsonResponse(template, 201);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  private async handleTemplate(request: Request, userId: string, templateId: string, method: string): Promise<Response> {
    if (method === 'GET') {
      const template = await this.db.getTemplate(templateId, userId);
      if (!template) {
        return jsonResponse({ error: "Template not found" }, 404);
      }

      // Add reference images
      const refImages = await this.db.getReferenceImages(template.id);
      for (const img of refImages) {
        img.url = await this.r2.getSignedUrl(img.r2_key);
      }
      template.reference_images = refImages;

      return jsonResponse(template);
    }

    if (method === 'PUT') {
      const data = await request.json();
      const updated = await this.db.updateTemplate(templateId, userId, data);

      if (!updated) {
        return jsonResponse({ error: "Template not found" }, 404);
      }

      return jsonResponse({ success: true });
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
        return jsonResponse({ error: "Template not found" }, 404);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  private async handleGenerations(request: Request, userId: string, method: string): Promise<Response> {
    if (method === 'GET') {
      const url = new URL(request.url);
      const limitParam = url.searchParams.get('limit');
      const before = url.searchParams.get('before') || undefined;
      let limit = 20;
      if (limitParam) {
        const parsed = parseInt(limitParam, 10);
        if (!Number.isNaN(parsed)) {
          limit = Math.max(1, Math.min(parsed, 50));
        }
      }

      const generations = await this.db.getGenerations(userId, { limit, before });

      const generationsWithOutputs = await Promise.all(
        generations.map(async (generation) => {
          const outputs = await this.db.getGenerationOutputs(generation.id);
          const outputsWithUrls = await Promise.all(
            outputs.map(async (output) => ({
              ...output,
              url: await this.r2.getSignedUrl(output.r2_key)
            }))
          );

          return {
            ...generation,
            preview_url: outputsWithUrls[0]?.url || null,
            outputs: outputsWithUrls
          };
        })
      );

      return jsonResponse(generationsWithOutputs);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  private async handleGenerationDetail(
    request: Request,
    userId: string,
    generationId: string,
    method: string
  ): Promise<Response> {
    if (method === 'GET') {
      const generation = await this.db.getGeneration(generationId, userId);
      if (!generation) {
        return jsonResponse({ error: "Generation not found" }, 404);
      }

      const [outputs, inputs] = await Promise.all([
        this.db.getGenerationOutputs(generationId),
        this.db.getGenerationInputs(generationId)
      ]);

      const outputsWithUrls = await Promise.all(
        outputs.map(async (output) => ({
          ...output,
          url: await this.r2.getSignedUrl(output.r2_key)
        }))
      );

      return jsonResponse({
        ...generation,
        outputs: outputsWithUrls,
        inputs
      });
    }

    if (method === 'DELETE') {
      const outputs = await this.db.getGenerationOutputs(generationId);
      await Promise.all(
        outputs.map(async (output) => {
          try {
            await this.r2.deleteFile(output.r2_key);
          } catch (error) {
            console.warn('Failed to delete generation output from R2', {
              generationId,
              key: output.r2_key,
              error
            });
          }
        })
      );

      const deleted = await this.db.deleteGeneration(generationId, userId);
      if (!deleted) {
        return jsonResponse({ error: "Generation not found" }, 404);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  private async handleGenerationOutputs(
    request: Request,
    userId: string,
    generationId: string,
    method: string
  ): Promise<Response> {
    if (method === 'GET') {
      const generation = await this.db.getGeneration(generationId, userId);
      if (!generation) {
        return jsonResponse({ error: "Generation not found" }, 404);
      }

      const outputs = await this.db.getGenerationOutputs(generationId);
      const outputsWithUrls = await Promise.all(
        outputs.map(async (output) => ({
          ...output,
          url: await this.r2.getSignedUrl(output.r2_key)
        }))
      );

      return jsonResponse(outputsWithUrls);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  private async handleSettings(request: Request, userId: string, method: string): Promise<Response> {
    if (method === 'GET') {
      const settings = await this.db.getSettings(userId);
      return jsonResponse(settings || {
        user_id: userId,
        favorites: {},
        show_only_favs: false
      });
    }

    if (method === 'PUT') {
      const data = await request.json();
      const { favorites, show_only_favs } = data;

      const settings = await this.db.createOrUpdateSettings(userId, favorites, show_only_favs);

      return jsonResponse(settings);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  }
}
