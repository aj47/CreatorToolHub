// React hook for managing cloud storage state and operations
import { useState, useEffect, useCallback } from 'react';
import { CloudStorageService, CloudTemplate, CloudUserImage, CloudSettings } from './client';

export interface UseCloudStorageOptions {
  autoSync?: boolean;
  syncInterval?: number; // milliseconds
}

export interface UseCloudStorageReturn {
  // State
  templates: CloudTemplate[];
  frames: CloudUserImage[];
  refFrames: CloudUserImage[];
  settings: CloudSettings | null;
  isLoading: boolean;
  isOnline: boolean;
  lastSync: Date | null;
  error: string | null;

  // Template operations
  createTemplate: (title: string, prompt: string, colors: string[]) => Promise<CloudTemplate>;
  updateTemplate: (id: string, updates: Partial<CloudTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  refreshTemplates: () => Promise<void>;

  // Image operations
  uploadFrame: (file: File) => Promise<CloudUserImage>;
  uploadRefFrame: (file: File) => Promise<CloudUserImage>;
  deleteFrame: (id: string) => Promise<void>;
  deleteRefFrame: (id: string) => Promise<void>;
  refreshImages: () => Promise<void>;

  // Settings operations
  updateSettings: (updates: Partial<CloudSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;

  // Migration and sync
  migrateFromLocalStorage: (data: any) => Promise<void>;
  syncAll: () => Promise<void>;
  clearError: () => void;
}

export function useCloudStorage(options: UseCloudStorageOptions = {}): UseCloudStorageReturn {
  const { autoSync = true, syncInterval = 30000 } = options;
  
  const [storage] = useState(() => new CloudStorageService());
  const [templates, setTemplates] = useState<CloudTemplate[]>([]);
  const [frames, setFrames] = useState<CloudUserImage[]>([]);
  const [refFrames, setRefFrames] = useState<CloudUserImage[]>([]);
  const [settings, setSettings] = useState<CloudSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Error handling
  const handleError = useCallback((error: any, operation: string) => {
    console.error(`Cloud storage error (${operation}):`, error);
    setError(error instanceof Error ? error.message : `Failed to ${operation}`);
    
    // Check if it's a network error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      setIsOnline(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Template operations
  const createTemplate = useCallback(async (title: string, prompt: string, colors: string[]): Promise<CloudTemplate> => {
    try {
      setIsLoading(true);
      const template = await storage.createTemplate(title, prompt, colors);
      setTemplates(prev => [template, ...prev]);
      setIsOnline(true);
      return template;
    } catch (error) {
      handleError(error, 'create template');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [storage, handleError]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<CloudTemplate>): Promise<void> => {
    try {
      setIsLoading(true);
      await storage.updateTemplate(id, updates);
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      setIsOnline(true);
    } catch (error) {
      handleError(error, 'update template');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [storage, handleError]);

  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    try {
      setIsLoading(true);
      await storage.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      setIsOnline(true);
    } catch (error) {
      handleError(error, 'delete template');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [storage, handleError]);

  const refreshTemplates = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const templates = await storage.getTemplates();
      setTemplates(templates);
      setIsOnline(true);
    } catch (error) {
      handleError(error, 'refresh templates');
    } finally {
      setIsLoading(false);
    }
  }, [storage, handleError]);

  // Image operations
  const uploadFrame = useCallback(async (file: File): Promise<CloudUserImage> => {
    try {
      setIsLoading(true);
      const image = await storage.uploadImage(file, 'frame');
      setFrames(prev => [image, ...prev]);
      setIsOnline(true);
      return image;
    } catch (error) {
      handleError(error, 'upload frame');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [storage, handleError]);

  const uploadRefFrame = useCallback(async (file: File): Promise<CloudUserImage> => {
    try {
      setIsLoading(true);
      const image = await storage.uploadImage(file, 'reference');
      setRefFrames(prev => [image, ...prev]);
      setIsOnline(true);
      return image;
    } catch (error) {
      handleError(error, 'upload reference frame');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [storage, handleError]);

  const deleteFrame = useCallback(async (id: string): Promise<void> => {
    try {
      setIsLoading(true);
      await storage.deleteImage(id);
      setFrames(prev => prev.filter(f => f.id !== id));
      setIsOnline(true);
    } catch (error) {
      handleError(error, 'delete frame');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [storage, handleError]);

  const deleteRefFrame = useCallback(async (id: string): Promise<void> => {
    try {
      setIsLoading(true);
      await storage.deleteImage(id);
      setRefFrames(prev => prev.filter(f => f.id !== id));
      setIsOnline(true);
    } catch (error) {
      handleError(error, 'delete reference frame');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [storage, handleError]);

  const refreshImages = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const [frameImages, refImages] = await Promise.all([
        storage.getImages('frame'),
        storage.getImages('reference')
      ]);
      setFrames(frameImages);
      setRefFrames(refImages);
      setIsOnline(true);
    } catch (error) {
      handleError(error, 'refresh images');
    } finally {
      setIsLoading(false);
    }
  }, [storage, handleError]);

  // Settings operations
  const updateSettings = useCallback(async (updates: Partial<CloudSettings>): Promise<void> => {
    try {
      setIsLoading(true);
      const newSettings = await storage.updateSettings(updates);
      setSettings(newSettings);
      setIsOnline(true);
    } catch (error) {
      handleError(error, 'update settings');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [storage, handleError]);

  const refreshSettings = useCallback(async (): Promise<void> => {
    try {
      const settings = await storage.getSettings();
      setSettings(settings);
      setIsOnline(true);
    } catch (error) {
      handleError(error, 'refresh settings');
    }
  }, [storage, handleError]);

  // Migration
  const migrateFromLocalStorage = useCallback(async (data: any): Promise<void> => {
    try {
      setIsLoading(true);
      const result = await storage.migrateFromLocalStorage(data);
      
      // Show migration results
      console.log('Migration completed:', result);
      if (result.errors.length > 0) {
        console.warn('Migration errors:', result.errors);
      }
      
      // Refresh all data after migration
      await Promise.all([
        refreshTemplates(),
        refreshImages(),
        refreshSettings()
      ]);
      
      setIsOnline(true);
    } catch (error) {
      handleError(error, 'migrate data');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [storage, handleError, refreshTemplates, refreshImages, refreshSettings]);

  // Sync all data
  const syncAll = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      await Promise.all([
        refreshTemplates(),
        refreshImages(),
        refreshSettings()
      ]);
      setLastSync(new Date());
    } catch (error) {
      handleError(error, 'sync data');
    } finally {
      setIsLoading(false);
    }
  }, [refreshTemplates, refreshImages, refreshSettings, handleError]);

  // Initial load and auto-sync
  useEffect(() => {
    syncAll();
  }, []);

  useEffect(() => {
    if (!autoSync) return;

    const interval = setInterval(() => {
      if (isOnline && !isLoading) {
        syncAll();
      }
    }, syncInterval);

    return () => clearInterval(interval);
  }, [autoSync, syncInterval, isOnline, isLoading, syncAll]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (autoSync) {
        syncAll();
      }
    };
    
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [autoSync, syncAll]);

  return {
    // State
    templates,
    frames,
    refFrames,
    settings,
    isLoading,
    isOnline,
    lastSync,
    error,

    // Template operations
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refreshTemplates,

    // Image operations
    uploadFrame,
    uploadRefFrame,
    deleteFrame,
    deleteRefFrame,
    refreshImages,

    // Settings operations
    updateSettings,
    refreshSettings,

    // Migration and sync
    migrateFromLocalStorage,
    syncAll,
    clearError,
  };
}
