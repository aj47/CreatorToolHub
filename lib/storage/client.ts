// Client-side storage service for interacting with cloud storage APIs

export interface CloudTemplate {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  colors: string[];
  created_at: string;
  updated_at: string;
  reference_images?: CloudReferenceImage[];
}

export interface CloudReferenceImage {
  id: string;
  template_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  r2_key: string;
  created_at: string;
  url?: string;
}

export type CloudGenerationStatus = 'pending' | 'running' | 'complete' | 'failed' | string;

export interface CloudGenerationOutput {
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
  url?: string;
}

export interface CloudGenerationInput {
  id: string;
  generation_id: string;
  input_type: string;
  source_id?: string;
  r2_key?: string;
  hash?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CloudGeneration {
  id: string;
  user_id: string;
  template_id?: string | null;
  prompt: string;
  variants_requested: number;
  status: CloudGenerationStatus;
  source?: string | null;
  parent_generation_id?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  preview_url?: string | null;
  outputs?: CloudGenerationOutput[];
  inputs?: CloudGenerationInput[];
}

export interface CloudSettings {
  user_id: string;
  favorites: Record<string, boolean>;
  show_only_favs: boolean;
  created_at: string;
  updated_at: string;
}

export class CloudStorageService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    // In production, use same-domain routing to avoid CORS/cookie issues
    // The worker routes are configured in wrangler.toml to handle /api/user/* on the same domain
    if (typeof window !== 'undefined') {
      // Client-side: use current origin for same-domain requests
      this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_WORKER_API_URL || window.location.origin;
    } else {
      // Server-side: use provided baseUrl or environment variable
      this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_WORKER_API_URL || '';
    }
  }

  // Template operations
  async getTemplates(): Promise<CloudTemplate[]> {
    if (!this.baseUrl) {
      // In development mode, return empty array instead of throwing
      if (process.env.NODE_ENV === 'development') {
        return [];
      }
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const response = await fetch(`${this.baseUrl}/api/user/templates`, {
      credentials: 'include'
    });
    if (!response.ok) {
      let errorMessage = `Failed to fetch templates (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage += `: ${errorData.error}`;
        } else if (response.statusText) {
          errorMessage += `: ${response.statusText}`;
        }
      } catch {
        if (response.statusText) {
          errorMessage += `: ${response.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }
    return await response.json();
  }

  async createTemplate(title: string, prompt: string, colors: string[]): Promise<CloudTemplate> {
    if (!this.baseUrl) {
      if (process.env.NODE_ENV === 'development') {
        // Return a mock template in development mode
        return {
          id: `dev-template-${Date.now()}`,
          user_id: 'dev@example.com',
          title,
          prompt,
          colors,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const response = await fetch(`${this.baseUrl}/api/user/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title, prompt, colors }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create template: ${response.statusText}`);
    }
    return await response.json();
  }

  async updateTemplate(id: string, updates: Partial<Pick<CloudTemplate, 'title' | 'prompt' | 'colors'>>): Promise<void> {
    if (!this.baseUrl) {
      if (process.env.NODE_ENV === 'development') {
        // In development mode, silently succeed
        return;
      }
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const response = await fetch(`${this.baseUrl}/api/user/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error(`Failed to update template: ${response.statusText}`);
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    if (!this.baseUrl) {
      if (process.env.NODE_ENV === 'development') {
        // In development mode, silently succeed
        return;
      }
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const response = await fetch(`${this.baseUrl}/api/user/templates/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      let errorMessage = `Failed to delete template (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage += `: ${errorData.error}`;
        } else if (response.statusText) {
          errorMessage += `: ${response.statusText}`;
        }
      } catch {
        // If we can't parse JSON, fall back to status text
        if (response.statusText) {
          errorMessage += `: ${response.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }
  }

  // Generation operations
  async getGenerations(params: { limit?: number; before?: string } = {}): Promise<CloudGeneration[]> {
    if (!this.baseUrl) {
      if (process.env.NODE_ENV === 'development') {
        return [];
      }
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const url = new URL(`${this.baseUrl}/api/user/generations`);
    if (params.limit !== undefined) {
      url.searchParams.set('limit', String(params.limit));
    }
    if (params.before) {
      url.searchParams.set('before', params.before);
    }

    const response = await fetch(url.toString(), {
      credentials: 'include'
    });

    if (!response.ok) {
      let message = `Failed to fetch generations (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          message += `: ${errorData.error}`;
        } else if (response.statusText) {
          message += `: ${response.statusText}`;
        }
      } catch {
        if (response.statusText) {
          message += `: ${response.statusText}`;
        }
      }
      throw new Error(message);
    }

    return await response.json();
  }

  async getGeneration(id: string): Promise<CloudGeneration | null> {
    if (!this.baseUrl) {
      if (process.env.NODE_ENV === 'development') {
        return null;
      }
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const response = await fetch(`${this.baseUrl}/api/user/generations/${id}`, {
      credentials: 'include'
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      let message = `Failed to fetch generation (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          message += `: ${errorData.error}`;
        } else if (response.statusText) {
          message += `: ${response.statusText}`;
        }
      } catch {
        if (response.statusText) {
          message += `: ${response.statusText}`;
        }
      }
      throw new Error(message);
    }

    return await response.json();
  }

  async getGenerationOutputs(id: string): Promise<CloudGenerationOutput[]> {
    if (!this.baseUrl) {
      if (process.env.NODE_ENV === 'development') {
        return [];
      }
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const response = await fetch(`${this.baseUrl}/api/user/generations/${id}/outputs`, {
      credentials: 'include'
    });

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch generation outputs: ${response.statusText}`);
    }

    return await response.json();
  }

  async deleteGeneration(id: string): Promise<void> {
    if (!this.baseUrl) {
      if (process.env.NODE_ENV === 'development') {
        return;
      }
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const response = await fetch(`${this.baseUrl}/api/user/generations/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.status === 404) {
      return;
    }

    if (!response.ok) {
      throw new Error(`Failed to delete generation: ${response.statusText}`);
    }
  }

  // Settings operations
  async getSettings(): Promise<CloudSettings | null> {
    if (!this.baseUrl) {
      if (process.env.NODE_ENV === 'development') {
        // Return mock settings in development mode
        return {
          user_id: 'dev@example.com',
          favorites: {},
          show_only_favs: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const response = await fetch(`${this.baseUrl}/api/user/settings`, {
      credentials: 'include'
    });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch settings: ${response.statusText}`);
    }
    return await response.json();
  }

  async updateSettings(updates: Partial<Pick<CloudSettings, 'favorites' | 'show_only_favs'>>): Promise<CloudSettings> {
    if (!this.baseUrl) {
      if (process.env.NODE_ENV === 'development') {
        // Return mock updated settings in development mode
        return {
          user_id: 'dev@example.com',
          favorites: updates.favorites || {},
          show_only_favs: updates.show_only_favs || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const response = await fetch(`${this.baseUrl}/api/user/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error(`Failed to update settings: ${response.statusText}`);
    }
    return await response.json();
  }


  // Utility methods
  async checkConnection(): Promise<boolean> {
    try {
      if (!this.baseUrl) {
        return false;
      }

      const response = await fetch(`${this.baseUrl}/api/user/profile`, {
        credentials: 'include'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Convert cloud template to legacy format for backward compatibility
  cloudTemplateToLegacy(template: CloudTemplate): any {
    return {
      title: template.title,
      prompt: template.prompt,
      colors: template.colors,
      referenceImages: template.reference_images?.map(img => img.url || img.r2_key) || [],
    };
  }

  // Convert legacy template to cloud format
  legacyTemplateToCloud(id: string, template: any): Omit<CloudTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
    return {
      title: template.title || 'Untitled',
      prompt: template.prompt || '',
      colors: Array.isArray(template.colors) ? template.colors : [],
    };
  }

}
