// localStorage implementation of StorageAdapter

import { StorageAdapter, StorageError, StorageErrorType } from '../core/types';

export class LocalAdapter implements StorageAdapter {
  private prefix: string;

  constructor(prefix: string = 'cth_') {
    this.prefix = prefix;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const item = localStorage.getItem(fullKey);
      
      if (item === null) {
        return null;
      }

      return JSON.parse(item) as T;
    } catch (error) {
      console.error('LocalAdapter get error:', error);
      throw this.createError(
        StorageErrorType.STORAGE_ERROR,
        `Failed to get item from localStorage: ${key}`,
        false
      );
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const serialized = JSON.stringify(value);
      
      localStorage.setItem(fullKey, serialized);
    } catch (error) {
      console.error('LocalAdapter set error:', error);
      
      // Check if it's a quota exceeded error
      if (error instanceof DOMException && error.code === 22) {
        throw this.createError(
          StorageErrorType.STORAGE_ERROR,
          'localStorage quota exceeded',
          false
        );
      }
      
      throw this.createError(
        StorageErrorType.STORAGE_ERROR,
        `Failed to set item in localStorage: ${key}`,
        true
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      localStorage.removeItem(fullKey);
    } catch (error) {
      console.error('LocalAdapter delete error:', error);
      throw this.createError(
        StorageErrorType.STORAGE_ERROR,
        `Failed to delete item from localStorage: ${key}`,
        true
      );
    }
  }

  async list(prefix: string): Promise<string[]> {
    try {
      const fullPrefix = this.getFullKey(prefix);
      const keys: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(fullPrefix)) {
          // Remove the full prefix to get the original key
          keys.push(key.substring(this.prefix.length));
        }
      }
      
      return keys;
    } catch (error) {
      console.error('LocalAdapter list error:', error);
      throw this.createError(
        StorageErrorType.STORAGE_ERROR,
        `Failed to list items from localStorage with prefix: ${prefix}`,
        true
      );
    }
  }

  async clear(): Promise<void> {
    try {
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('LocalAdapter clear error:', error);
      throw this.createError(
        StorageErrorType.STORAGE_ERROR,
        'Failed to clear localStorage',
        true
      );
    }
  }

  // Utility methods
  private getFullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private createError(
    type: StorageErrorType,
    message: string,
    recoverable: boolean
  ): StorageError {
    return {
      type,
      message,
      recoverable,
    };
  }

  // Check if localStorage is available
  static isAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  // Get storage usage information
  getUsageInfo(): { used: number; available: number } {
    try {
      let used = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          const value = localStorage.getItem(key);
          if (value) {
            used += key.length + value.length;
          }
        }
      }

      // Rough estimate of available space (5MB is typical localStorage limit)
      const totalEstimate = 5 * 1024 * 1024; // 5MB in bytes
      const available = Math.max(0, totalEstimate - used);

      return { used, available };
    } catch {
      return { used: 0, available: 0 };
    }
  }
}
