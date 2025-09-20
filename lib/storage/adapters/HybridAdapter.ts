// Coordinated hybrid storage adapter

import { StorageAdapter, SyncStatus, SyncDirection, StorageError, StorageErrorType } from '../core/types';
import { LocalAdapter } from './LocalAdapter';
import { CloudAdapter } from './CloudAdapter';
import { getRequestManager } from '../../api/RequestManager';

export interface HybridConfig {
  preferCloud: boolean;
  syncOnWrite: boolean;
  syncInterval: number;
  conflictResolution: 'local' | 'cloud' | 'newest';
}

export class HybridAdapter implements StorageAdapter {
  private localAdapter: LocalAdapter;
  private cloudAdapter: CloudAdapter;
  private config: HybridConfig;
  private syncState = new Map<string, SyncStatus>();
  private requestManager = getRequestManager();
  private syncTimer?: NodeJS.Timeout;

  constructor(
    localAdapter?: LocalAdapter,
    cloudAdapter?: CloudAdapter,
    config: Partial<HybridConfig> = {}
  ) {
    this.localAdapter = localAdapter || new LocalAdapter();
    this.cloudAdapter = cloudAdapter || new CloudAdapter();
    this.config = {
      preferCloud: config.preferCloud ?? true,
      syncOnWrite: config.syncOnWrite ?? true,
      syncInterval: config.syncInterval ?? 60000, // 1 minute
      conflictResolution: config.conflictResolution ?? 'newest',
    };

    // Start periodic sync
    this.startPeriodicSync();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.config.preferCloud) {
        // Try cloud first, fallback to local
        try {
          const cloudValue = await this.requestManager.execute(
            () => this.cloudAdapter.get<T>(key),
            { priority: 1, deduplicationKey: `get_${key}` }
          );
          
          if (cloudValue !== null) {
            // Update local cache in background
            this.localAdapter.set(key, cloudValue).catch(console.error);
            return cloudValue;
          }
        } catch (error) {
          console.warn('Cloud get failed, falling back to local:', error);
        }

        // Fallback to local
        return await this.localAdapter.get<T>(key);
      } else {
        // Try local first, fallback to cloud
        const localValue = await this.localAdapter.get<T>(key);
        if (localValue !== null) {
          return localValue;
        }

        // Fallback to cloud
        try {
          const cloudValue = await this.requestManager.execute(
            () => this.cloudAdapter.get<T>(key),
            { priority: 1, deduplicationKey: `get_${key}` }
          );
          
          if (cloudValue !== null) {
            // Update local cache
            await this.localAdapter.set(key, cloudValue);
          }
          
          return cloudValue;
        } catch (error) {
          console.warn('Cloud get failed:', error);
          return null;
        }
      }
    } catch (error) {
      console.error('HybridAdapter get error:', error);
      throw this.createError(
        StorageErrorType.STORAGE_ERROR,
        `Failed to get item: ${key}`,
        true
      );
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      // Always write to local first for immediate consistency
      await this.localAdapter.set(key, value);

      if (this.config.syncOnWrite) {
        // Sync to cloud in background
        this.syncToCloud(key, value).catch(error => {
          console.error('Background sync to cloud failed:', error);
        });
      }
    } catch (error) {
      console.error('HybridAdapter set error:', error);
      throw this.createError(
        StorageErrorType.STORAGE_ERROR,
        `Failed to set item: ${key}`,
        true
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      // Delete from both local and cloud
      await Promise.allSettled([
        this.localAdapter.delete(key),
        this.requestManager.execute(
          () => this.cloudAdapter.delete(key),
          { priority: 2, deduplicationKey: `delete_${key}` }
        ),
      ]);
    } catch (error) {
      console.error('HybridAdapter delete error:', error);
      throw this.createError(
        StorageErrorType.STORAGE_ERROR,
        `Failed to delete item: ${key}`,
        true
      );
    }
  }

  async list(prefix: string): Promise<string[]> {
    try {
      const [localKeys, cloudKeys] = await Promise.allSettled([
        this.localAdapter.list(prefix),
        this.requestManager.execute(
          () => this.cloudAdapter.list(prefix),
          { priority: 1, deduplicationKey: `list_${prefix}` }
        ),
      ]);

      const local = localKeys.status === 'fulfilled' ? localKeys.value : [];
      const cloud = cloudKeys.status === 'fulfilled' ? cloudKeys.value : [];

      // Merge and deduplicate
      const allKeys = new Set([...local, ...cloud]);
      return Array.from(allKeys);
    } catch (error) {
      console.error('HybridAdapter list error:', error);
      throw this.createError(
        StorageErrorType.STORAGE_ERROR,
        `Failed to list items with prefix: ${prefix}`,
        true
      );
    }
  }

  async clear(): Promise<void> {
    try {
      await Promise.allSettled([
        this.localAdapter.clear(),
        this.requestManager.execute(
          () => this.cloudAdapter.clear(),
          { priority: 2, deduplicationKey: 'clear_all' }
        ),
      ]);
    } catch (error) {
      console.error('HybridAdapter clear error:', error);
      throw this.createError(
        StorageErrorType.STORAGE_ERROR,
        'Failed to clear storage',
        true
      );
    }
  }

  // Sync operations
  async sync(key: string, direction: SyncDirection = 'both'): Promise<void> {
    const status = this.syncState.get(key);
    if (status?.inProgress) {
      return; // Prevent duplicate syncs
    }

    this.syncState.set(key, { inProgress: true, lastSync: Date.now() });

    try {
      await this.performSync(key, direction);
    } finally {
      this.syncState.set(key, { inProgress: false, lastSync: Date.now() });
    }
  }

  private async performSync(key: string, direction: SyncDirection): Promise<void> {
    try {
      if (direction === 'up' || direction === 'both') {
        // Sync local to cloud
        const localValue = await this.localAdapter.get(key);
        if (localValue !== null) {
          await this.requestManager.execute(
            () => this.cloudAdapter.set(key, localValue),
            { priority: 3, deduplicationKey: `sync_up_${key}` }
          );
        }
      }

      if (direction === 'down' || direction === 'both') {
        // Sync cloud to local
        const cloudValue = await this.requestManager.execute(
          () => this.cloudAdapter.get(key),
          { priority: 3, deduplicationKey: `sync_down_${key}` }
        );
        
        if (cloudValue !== null) {
          await this.localAdapter.set(key, cloudValue);
        }
      }
    } catch (error) {
      console.error('Sync operation failed:', error);
      throw error;
    }
  }

  private async syncToCloud<T>(key: string, value: T): Promise<void> {
    try {
      await this.requestManager.execute(
        () => this.cloudAdapter.set(key, value),
        { priority: 3, deduplicationKey: `sync_${key}` }
      );
    } catch (error) {
      // Don't throw - this is a background operation
      console.error('Background sync to cloud failed:', error);
    }
  }

  private startPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.performPeriodicSync().catch(console.error);
    }, this.config.syncInterval);
  }

  private async performPeriodicSync(): Promise<void> {
    try {
      // Get all local keys and sync them
      const localKeys = await this.localAdapter.list('');
      
      for (const key of localKeys) {
        // Skip if already syncing
        const status = this.syncState.get(key);
        if (status?.inProgress) continue;

        // Sync with low priority
        this.sync(key, 'up').catch(console.error);
      }
    } catch (error) {
      console.error('Periodic sync failed:', error);
    }
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

  // Cleanup
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }
}
