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

export interface CloudUserImage {
  id: string;
  user_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  r2_key: string;
  image_type: 'frame' | 'reference';
  hash?: string;
  created_at: string;
  url?: string;
}

export interface CloudSettings {
  user_id: string;
  favorites: Record<string, boolean>;
  show_only_favs: boolean;
  created_at: string;
  updated_at: string;
}

export interface MigrationResult {
  templates: number;
  frames: number;
  refFrames: number;
  settings: boolean;
  errors: string[];
}

export class CloudStorageService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_WORKER_API_URL || '';
  }

  // Template operations
  async getTemplates(): Promise<CloudTemplate[]> {
    if (!this.baseUrl) {
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const response = await fetch(`${this.baseUrl}/api/user/templates`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.statusText}`);
    }
    return await response.json();
  }

  async createTemplate(title: string, prompt: string, colors: string[]): Promise<CloudTemplate> {
    if (!this.baseUrl) {
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
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const response = await fetch(`${this.baseUrl}/api/user/templates/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete template: ${response.statusText}`);
    }
  }

  // Image operations
  async getImages(type?: 'frame' | 'reference'): Promise<CloudUserImage[]> {
    if (!this.baseUrl) {
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    try {
      const url = new URL(`${this.baseUrl}/api/user/images`);
      if (type) {
        url.searchParams.set('type', type);
      }

      const response = await fetch(url.toString(), {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch images: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Invalid URL')) {
        throw new Error(`Invalid cloud storage URL: ${this.baseUrl}/api/user/images`);
      }
      throw error;
    }
  }

  async uploadImage(file: File, imageType: 'frame' | 'reference'): Promise<CloudUserImage> {
    if (!this.baseUrl) {
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('image_type', imageType);

    const response = await fetch(`${this.baseUrl}/api/user/images`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Failed to upload image: ${response.statusText}`);
    }
    return await response.json();
  }

  async deleteImage(id: string): Promise<void> {
    if (!this.baseUrl) {
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const response = await fetch(`${this.baseUrl}/api/user/images/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete image: ${response.statusText}`);
    }
  }

  // Settings operations
  async getSettings(): Promise<CloudSettings | null> {
    if (!this.baseUrl) {
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

  // Migration from localStorage
  async migrateFromLocalStorage(data: {
    templates?: Record<string, any>;
    frames?: any[];
    refFrames?: any[];
    settings?: any;
  }): Promise<MigrationResult> {
    if (!this.baseUrl) {
      throw new Error('Cloud storage not configured - baseUrl is empty');
    }

    const response = await fetch(`${this.baseUrl}/api/user/migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to migrate data: ${response.statusText}`);
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

  // Convert cloud image to legacy frame format
  cloudImageToLegacyFrame(image: CloudUserImage): any {
    return {
      dataUrl: image.url || '', // Will need to fetch actual data URL if needed
      b64: '', // Will be populated when needed
      kind: 'image',
      filename: image.filename,
      hash: image.hash,
      importedAt: new Date(image.created_at).getTime(),
    };
  }

  // Helper to convert data URL to File for upload
  dataUrlToFile(dataUrl: string, filename: string): File {
    const [header, base64Data] = dataUrl.split(',');
    const contentTypeMatch = header.match(/data:([^;]+)/);
    const contentType = contentTypeMatch ? contentTypeMatch[1] : 'image/jpeg';
    
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new File([bytes], filename, { type: contentType });
  }

  // Helper to fetch image as data URL (for backward compatibility)
  async fetchImageAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
