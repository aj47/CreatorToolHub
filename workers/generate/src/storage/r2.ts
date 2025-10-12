// R2 storage operations for file management
import { generateR2Key, isValidImageType, isValidFileSize, calculateFileHash } from './utils';

export class R2StorageService {
  constructor(private r2: any, private env?: any) {}

  /**
   * Upload a template reference image to R2 storage
   */
  async uploadTemplateReference(
    userId: string,
    templateId: string,
    file: File
  ): Promise<{ key: string; hash: string; sizeBytes: number }> {
    if (!isValidImageType(file.type)) {
      throw new Error(`Invalid file type: ${file.type}`);
    }

    if (!isValidFileSize(file.size)) {
      throw new Error(`File too large: ${file.size} bytes`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const hash = await calculateFileHash(arrayBuffer);
    const key = generateR2Key(userId, 'template-reference', {
      templateId,
      filename: file.name
    });

    await this.r2.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000'
      },
      customMetadata: {
        originalFilename: file.name,
        uploadedBy: userId,
        hash
      }
    });

    return { key, hash, sizeBytes: arrayBuffer.byteLength };
  }

  /**
   * Upload template reference from ArrayBuffer (for migrations)
   */
  async uploadTemplateReferenceFromBuffer(
    userId: string,
    templateId: string,
    buffer: ArrayBuffer,
    filename: string,
    contentType: string
  ): Promise<{ key: string; hash: string; sizeBytes: number }> {
    if (!isValidImageType(contentType)) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    if (!isValidFileSize(buffer.byteLength)) {
      throw new Error(`File too large: ${buffer.byteLength} bytes`);
    }

    const hash = await calculateFileHash(buffer);
    const key = generateR2Key(userId, 'template-reference', {
      templateId,
      filename
    });

    await this.r2.put(key, buffer, {
      httpMetadata: {
        contentType,
        cacheControl: 'public, max-age=31536000'
      },
      customMetadata: {
        originalFilename: filename,
        uploadedBy: userId,
        hash
      }
    });

    return { key, hash, sizeBytes: buffer.byteLength };
  }

  /**
   * Get file from R2
   */
  async getFile(key: string): Promise<any | null> {
    return await this.r2.get(key);
  }

  /**
   * Delete file from R2
   */
  async deleteFile(key: string): Promise<void> {
    await this.r2.delete(key);
  }

  /**
   * Generate a signed URL for accessing the file
   * In local development, returns a local proxy URL
   * In production, uses the worker's direct domain for file serving
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // In development, use local proxy
    if (this.env?.NODE_ENV === 'development' || !this.env?.NODE_ENV) {
      return `http://localhost:8787/api/r2/${encodeURIComponent(key)}`;
    }

    // In production, use the worker's direct domain
    // This avoids the Next.js API route proxy which doesn't work with Cloudflare Pages
    return `https://creator-tool-hub.techfren.workers.dev/api/r2/${encodeURIComponent(key)}`;
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    const object = await this.r2.head(key);
    return object !== null;
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<any | null> {
    return await this.r2.head(key);
  }

  /**
   * List files with prefix
   */
  async listFiles(prefix: string, limit: number = 100): Promise<any> {
    return await this.r2.list({
      prefix: prefix,
      limit: limit,
    });
  }

  /**
   * Copy file to new location
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    const sourceObject = await this.r2.get(sourceKey);
    if (!sourceObject) {
      throw new Error(`Source file not found: ${sourceKey}`);
    }
    
    await this.r2.put(destinationKey, sourceObject.body, {
      httpMetadata: sourceObject.httpMetadata,
      customMetadata: sourceObject.customMetadata,
    });
  }

  /**
   * Bulk delete files
   */
  async deleteFiles(keys: string[]): Promise<void> {
    // R2 supports bulk delete, but for simplicity we'll delete one by one
    // In production, you might want to use the bulk delete API
    await Promise.all(keys.map(key => this.deleteFile(key)));
  }

  /**
   * Get file as base64 data URL (for backward compatibility)
   */
  async getFileAsDataUrl(key: string): Promise<string | null> {
    const object = await this.r2.get(key);
    if (!object) return null;
    
    const arrayBuffer = await object.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
    
    return `data:${contentType};base64,${base64}`;
  }

  /**
   * Upload template reference provided as a data URL
   */
  async uploadTemplateReferenceFromDataUrl(
    userId: string,
    templateId: string,
    dataUrl: string,
    filename: string
  ): Promise<{ key: string; hash: string; sizeBytes: number; contentType: string }> {
    const { buffer, contentType } = this.decodeDataUrl(dataUrl);
    const result = await this.uploadTemplateReferenceFromBuffer(
      userId,
      templateId,
      buffer,
      filename,
      contentType
    );

    return { ...result, contentType };
  }

  /**
   * Persist generation output image to R2
   */
  async saveGenerationOutputFromDataUrl(
    userId: string,
    generationId: string,
    variantIndex: number,
    dataUrl: string
  ): Promise<{ key: string; hash: string; sizeBytes: number; contentType: string }> {
    const { buffer, contentType } = this.decodeDataUrl(dataUrl);

    if (!isValidImageType(contentType)) {
      throw new Error(`Invalid generation output content type: ${contentType}`);
    }

    if (!isValidFileSize(buffer.byteLength)) {
      throw new Error(`Generated image too large: ${buffer.byteLength} bytes`);
    }

    const hash = await calculateFileHash(buffer);
    const key = generateR2Key(userId, 'generation-output', {
      generationId,
      variantIndex,
      extension: this.extensionFromContentType(contentType)
    });

    await this.r2.put(key, buffer, {
      httpMetadata: {
        contentType,
        cacheControl: 'public, max-age=31536000'
      },
      customMetadata: {
        uploadedBy: userId,
        generationId,
        hash,
        variantIndex: String(variantIndex)
      }
    });

    return { key, hash, sizeBytes: buffer.byteLength, contentType };
  }

  private decodeDataUrl(dataUrl: string): { buffer: ArrayBuffer; contentType: string } {
    const [header, base64Data] = dataUrl.split(',');
    if (!header || !base64Data) {
      throw new Error('Invalid data URL format');
    }

    const contentTypeMatch = header.match(/data:([^;]+)/);
    const contentType = contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream';

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return { buffer: bytes.buffer, contentType };
  }

  private extensionFromContentType(contentType: string): string {
    const parts = contentType.split('/');
    if (parts.length === 2) {
      return parts[1];
    }
    return 'bin';
  }
}
