// R2 storage operations for file management
import { generateR2Key, isValidImageType, isValidFileSize, calculateFileHash } from './utils';

export class R2StorageService {
  constructor(private r2: any) {}

  /**
   * Upload a file to R2 storage
   */
  async uploadFile(
    userId: string, 
    file: File, 
    type: 'template' | 'image', 
    subType?: string
  ): Promise<{ key: string; hash: string }> {
    // Validate file
    if (!isValidImageType(file.type)) {
      throw new Error(`Invalid file type: ${file.type}`);
    }
    
    if (!isValidFileSize(file.size)) {
      throw new Error(`File too large: ${file.size} bytes`);
    }
    
    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const hash = await calculateFileHash(arrayBuffer);
    
    // Generate R2 key
    const key = generateR2Key(userId, type, subType, file.name);
    
    // Upload to R2
    await this.r2.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000', // 1 year
      },
      customMetadata: {
        originalFilename: file.name,
        uploadedBy: userId,
        hash: hash,
      },
    });
    
    return { key, hash };
  }

  /**
   * Upload file from ArrayBuffer (for migration from base64)
   */
  async uploadFromBuffer(
    userId: string,
    buffer: ArrayBuffer,
    filename: string,
    contentType: string,
    type: 'template' | 'image',
    subType?: string
  ): Promise<{ key: string; hash: string }> {
    // Validate
    if (!isValidImageType(contentType)) {
      throw new Error(`Invalid content type: ${contentType}`);
    }
    
    if (!isValidFileSize(buffer.byteLength)) {
      throw new Error(`File too large: ${buffer.byteLength} bytes`);
    }
    
    const hash = await calculateFileHash(buffer);
    const key = generateR2Key(userId, type, subType, filename);
    
    // Upload to R2
    await this.r2.put(key, buffer, {
      httpMetadata: {
        contentType: contentType,
        cacheControl: 'public, max-age=31536000',
      },
      customMetadata: {
        originalFilename: filename,
        uploadedBy: userId,
        hash: hash,
      },
    });
    
    return { key, hash };
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
   * Note: This is a placeholder - actual signed URL generation requires additional setup
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // For now, return a placeholder URL
    // In production, you'd implement proper signed URL generation
    return `https://your-r2-domain.com/${key}?expires=${Date.now() + expiresIn * 1000}`;
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
   * Convert base64 data URL to file and upload
   */
  async uploadFromDataUrl(
    userId: string,
    dataUrl: string,
    filename: string,
    type: 'template' | 'image',
    subType?: string
  ): Promise<{ key: string; hash: string }> {
    // Parse data URL
    const [header, base64Data] = dataUrl.split(',');
    if (!header || !base64Data) {
      throw new Error('Invalid data URL format');
    }
    
    // Extract content type
    const contentTypeMatch = header.match(/data:([^;]+)/);
    const contentType = contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream';
    
    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return await this.uploadFromBuffer(userId, bytes.buffer, filename, contentType, type, subType);
  }
}
