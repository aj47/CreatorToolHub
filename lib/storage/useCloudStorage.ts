// React hook for managing cloud storage state and operations
import { useState, useEffect, useCallback } from 'react';
import { CloudStorageService, CloudTemplate, CloudSettings, CloudGeneration, CloudGenerationOutput } from './client';

export interface UseCloudStorageOptions {
  autoSync?: boolean;
  syncInterval?: number; // milliseconds
}

export interface UseCloudStorageReturn {
  // State
  templates: CloudTemplate[];
  generations: CloudGeneration[];
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

  // Generation operations
  refreshGenerations: (params?: { limit?: number; before?: string }) => Promise<void>;
  fetchGeneration: (id: string) => Promise<CloudGeneration | null>;
  deleteGeneration: (id: string) => Promise<void>;
  getGenerationOutputs: (id: string) => Promise<CloudGenerationOutput[]>;

  // Settings operations
  updateSettings: (updates: Partial<CloudSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;

  // Sync and utility
  syncAll: () => Promise<void>;
  clearError: () => void;
}

export function useCloudStorage(options: UseCloudStorageOptions = {}): UseCloudStorageReturn {
  const { autoSync = true, syncInterval = 60000 } = options; // Increased from 30s to 60s

  const [storage] = useState(() => new CloudStorageService());
  const [templates, setTemplates] = useState<CloudTemplate[]>([]);
  const [generations, setGenerations] = useState<CloudGeneration[]>([]);
  const [settings, setSettings] = useState<CloudSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRequestTime, setLastRequestTime] = useState(0);

  const requestCooldownMs = 750;

  const shouldThrottleRequest = useCallback((): boolean => {
    const now = Date.now();
    if (now - lastRequestTime < requestCooldownMs) {
      return true;
    }
    setLastRequestTime(now);
    return false;
  }, [lastRequestTime]);

  // Error handling
  const handleError = useCallback((error: unknown, operation: string) => {
    console.error(`Cloud storage error (${operation}):`, error);
    const message = error instanceof Error ? error.message : `Failed to ${operation}`;
    setError(message);

    if (error instanceof TypeError && error.message.includes('fetch')) {
      setIsOnline(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);


  const execute = useCallback(async <T,>(operation: string, fn: () => Promise<T>): Promise<T> => {
    setIsLoading(true);
    try {
      const result = await fn();
      setIsOnline(true);
      return result;
    } catch (error) {
      handleError(error, operation);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  // Template operations
  const createTemplate = useCallback(async (title: string, prompt: string, colors: string[]): Promise<CloudTemplate> => {
    return await execute('create template', async () => {
      const template = await storage.createTemplate(title, prompt, colors);
      setTemplates(prev => [template, ...prev]);
      return template;
    });
  }, [storage, execute]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<CloudTemplate>): Promise<void> => {
    await execute('update template', async () => {
      await storage.updateTemplate(id, updates);
      setTemplates(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
    });
  }, [storage, execute]);

  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    await execute('delete template', async () => {
      await storage.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    });
  }, [storage, execute]);

  const refreshTemplates = useCallback(async (): Promise<void> => {
    if (shouldThrottleRequest()) {
      return; // Skip this request due to throttling
    }

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
  }, [storage, handleError, shouldThrottleRequest]);

  // Generation operations
  const refreshGenerations = useCallback(async (params: { limit?: number; before?: string } = {}): Promise<void> => {
    if (shouldThrottleRequest()) {
      return;
    }

    try {
      setIsLoading(true);
      const list = await storage.getGenerations(params);
      setGenerations(list);
      setIsOnline(true);
    } catch (error) {
      handleError(error, 'refresh generations');
    } finally {
      setIsLoading(false);
    }
  }, [storage, handleError, shouldThrottleRequest]);

  const fetchGeneration = useCallback(async (id: string): Promise<CloudGeneration | null> => {
    return await execute('fetch generation', async () => {
      const generation = await storage.getGeneration(id);
      if (generation) {
        setGenerations(prev => {
          const index = prev.findIndex(g => g.id === id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = { ...prev[index], ...generation };
            return next;
          }
          return [generation, ...prev];
        });
      }
      return generation;
    });
  }, [storage, execute]);

  const deleteGeneration = useCallback(async (id: string): Promise<void> => {
    await execute('delete generation', async () => {
      await storage.deleteGeneration(id);
      setGenerations(prev => prev.filter(g => g.id !== id));
    });
  }, [storage, execute]);

  const getGenerationOutputs = useCallback(async (id: string): Promise<CloudGenerationOutput[]> => {
    return await execute('fetch generation outputs', async () => {
      const outputs = await storage.getGenerationOutputs(id);
      setGenerations(prev => prev.map(g => (g.id === id ? { ...g, outputs } : g)));
      return outputs;
    });
  }, [storage, execute]);

  // Settings operations
  const updateSettings = useCallback(async (updates: Partial<CloudSettings>): Promise<void> => {
    await execute('update settings', async () => {
      const newSettings = await storage.updateSettings(updates);
      setSettings(newSettings);
    });
  }, [storage, execute]);

  const refreshSettings = useCallback(async (): Promise<void> => {
    if (shouldThrottleRequest()) {
      return; // Skip this request due to throttling
    }

    try {
      const settings = await storage.getSettings();
      setSettings(settings);
      setIsOnline(true);
    } catch (error) {
      handleError(error, 'refresh settings');
    }
  }, [storage, handleError, shouldThrottleRequest]);


  // Sync all data
  const syncAll = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const [templateList, generationList, settingsValue] = await Promise.all([
        storage.getTemplates(),
        storage.getGenerations(),
        storage.getSettings()
      ]);
      setTemplates(templateList);
      setGenerations(generationList);
      setSettings(settingsValue);
      setIsOnline(true);
      setLastSync(new Date());
    } catch (error) {
      handleError(error, 'sync data');
    } finally {
      setIsLoading(false);
    }
  }, [storage, handleError]);

  // Initial load and auto-sync - disabled in production
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      syncAll();
    }
  }, [syncAll]);

  useEffect(() => {
    // Auto-sync disabled in production until worker issues are resolved
    if (process.env.NODE_ENV === 'development' && autoSync) {
      const interval = setInterval(() => {
        if (isOnline && !isLoading) {
          syncAll();
        }
      }, syncInterval);

      return () => clearInterval(interval);
    }
  }, [autoSync, syncInterval, isOnline, isLoading, syncAll]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync disabled in production
      if (process.env.NODE_ENV === 'development' && autoSync) {
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
    templates,
    generations,
    settings,
    isLoading,
    isOnline,
    lastSync,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refreshTemplates,
    refreshGenerations,
    fetchGeneration,
    deleteGeneration,
    getGenerationOutputs,
    updateSettings,
    refreshSettings,
    syncAll,
    clearError,
  };
}
