// Cloud storage implementation of StorageAdapter

import { StorageAdapter, StorageError, StorageErrorType } from '../core/types';

export class CloudAdapter implements StorageAdapter {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeout: number = 10000) {
    // Always use same-origin relative API paths in the browser
    this.baseUrl = '';
    this.timeout = timeout;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/user/storage/${encodeURIComponent(key)}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.value as T;
    } catch (error) {
      throw this.createNetworkError(`Failed to get item from cloud storage: ${key}`, error);
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/user/storage/${encodeURIComponent(key)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      throw this.createNetworkError(`Failed to set item in cloud storage: ${key}`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/user/storage/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      throw this.createNetworkError(`Failed to delete item from cloud storage: ${key}`, error);
    }
  }

  async list(prefix: string): Promise<string[]> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/user/storage?prefix=${encodeURIComponent(prefix)}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.keys || [];
    } catch (error) {
      throw this.createNetworkError(`Failed to list items from cloud storage with prefix: ${prefix}`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/user/storage`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      throw this.createNetworkError('Failed to clear cloud storage', error);
    }
  }

  // Utility methods
  private getDefaultBaseUrl(): string {
    // Unused after constructor change; kept for backward compatibility
    return '';
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private createNetworkError(message: string, originalError: any): StorageError {
    const isNetworkError = originalError instanceof TypeError || 
                          originalError.name === 'AbortError' ||
                          originalError.message?.includes('fetch');

    return {
      type: isNetworkError ? StorageErrorType.NETWORK_ERROR : StorageErrorType.STORAGE_ERROR,
      message,
      recoverable: isNetworkError,
      retryAfter: isNetworkError ? 5000 : undefined, // 5 seconds for network errors
    };
  }

  // Check if cloud storage is available
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/user/health`, {
        method: 'GET',
        credentials: 'include',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Get connection status
  async getStatus(): Promise<{ connected: boolean; latency?: number }> {
    const startTime = Date.now();
    try {
      const available = await this.isAvailable();
      const latency = Date.now() - startTime;
      return { connected: available, latency };
    } catch {
      return { connected: false };
    }
  }
}
