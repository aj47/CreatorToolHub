// Hybrid storage hook that uses cloud storage when available, localStorage as fallback
import { useState, useEffect, useCallback } from 'react';
import { useCloudStorage } from './useCloudStorage';
import { CloudStorageService } from './client';

// Legacy types for backward compatibility
export interface LegacyFrame {
  dataUrl: string;
  b64: string;
  kind: 'frame' | 'image';
  filename?: string;
  hash?: string;
  importedAt?: number;
}

export interface LegacyPreset {
  title: string;
  prompt: string;
  colors: string[];
  referenceImages: string[];
}

export interface UseHybridStorageReturn {
  // Unified interface that works with both cloud and localStorage
  templates: Record<string, LegacyPreset>;
  frames: LegacyFrame[];
  refFrames: LegacyFrame[];
  favorites: Record<string, boolean>;
  showOnlyFavs: boolean;
  
  // State
  isCloudEnabled: boolean;
  isOnline: boolean;
  isLoading: boolean;
  isMigrated: boolean;
  error: string | null;
  
  // Operations
  createTemplate: (preset: LegacyPreset) => Promise<string>;
  updateTemplate: (id: string, updates: Partial<LegacyPreset>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  
  addFrame: (frame: LegacyFrame) => Promise<void>;
  removeFrame: (index: number) => Promise<void>;
  uploadFrame: (file: File) => Promise<{ id: string }>;
  deleteFrame: (id: string) => Promise<void>;

  addRefFrame: (frame: LegacyFrame) => Promise<void>;
  removeRefFrame: (index: number) => Promise<void>;
  uploadRefFrame: (file: File) => Promise<{ id: string }>;
  deleteRefFrame: (id: string) => Promise<void>;
  
  updateFavorites: (favorites: Record<string, boolean>) => Promise<void>;
  updateShowOnlyFavs: (show: boolean) => Promise<void>;
  
  // Migration
  triggerMigration: () => Promise<void>;
  migrateFromLocalStorage: (data: any) => Promise<void>;
  clearError: () => void;
}

export function useHybridStorage(): UseHybridStorageReturn {
  // Cloud storage hook
  const cloudStorage = useCloudStorage({ autoSync: true });

  // Create storage service instance
  const [storage] = useState(() => new CloudStorageService());
  
  // Local state for localStorage fallback
  const [localTemplates, setLocalTemplates] = useState<Record<string, LegacyPreset>>({});
  const [localFrames, setLocalFrames] = useState<LegacyFrame[]>([]);
  const [localRefFrames, setLocalRefFrames] = useState<LegacyFrame[]>([]);
  const [localFavorites, setLocalFavorites] = useState<Record<string, boolean>>({});
  const [localShowOnlyFavs, setLocalShowOnlyFavs] = useState(false);
  
  // Migration state
  const [isMigrated, setIsMigrated] = useState(false);
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);

  // Check if user is authenticated and cloud storage is available
  useEffect(() => {
    const checkCloudAvailability = async () => {
      // In development mode, create a mock auth token for testing
      if (process.env.NODE_ENV === 'development') {
        const mockToken = btoa(JSON.stringify({
          email: 'dev@example.com',
          name: 'Dev User',
          picture: '',
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        }));
        document.cookie = `auth-token=${mockToken}; path=/; max-age=86400`;

        try {
          // Check if we can connect to the cloud storage API
          const isAvailable = await storage.checkConnection();
          if (isAvailable) {
            setIsCloudEnabled(true);
            console.log('Cloud storage available');
          } else {
            console.log('Cloud storage not available, using localStorage fallback');
            setIsCloudEnabled(false);
          }
        } catch (error) {
          console.log('Cloud storage not available, using localStorage fallback:', error);
          setIsCloudEnabled(false);
        }
      } else {
        // Temporarily disable cloud storage in production until issues are resolved
        console.log('Cloud storage temporarily disabled in production');
        setIsCloudEnabled(false);
      }
    };

    // Add a delay to prevent immediate requests on page load
    const timeoutId = setTimeout(checkCloudAvailability, 1000);
    return () => clearTimeout(timeoutId);
  }, [storage, cloudStorage]);

  // Load localStorage data
  useEffect(() => {
    try {
      // Load templates
      const templatesData = localStorage.getItem('cg_custom_presets_v2');
      if (templatesData) {
        setLocalTemplates(JSON.parse(templatesData));
      }
      
      // Load frames
      const framesData = localStorage.getItem('cg_frames_v1');
      if (framesData) {
        setLocalFrames(JSON.parse(framesData));
      }

      // Load reference frames
      const refFramesData = localStorage.getItem('cg_ref_frames_v1');
      if (refFramesData) {
        setLocalRefFrames(JSON.parse(refFramesData));
      }
      
      // Load favorites
      const favoritesData = localStorage.getItem('cg_style_favs_v2');
      if (favoritesData) {
        setLocalFavorites(JSON.parse(favoritesData));
      }
      
      // Load show only favs setting
      const showOnlyFavsData = localStorage.getItem('cg_gallery_only_favs_v1');
      if (showOnlyFavsData) {
        setLocalShowOnlyFavs(showOnlyFavsData === '1' || showOnlyFavsData === 'true');
      }
    } catch (error) {
      console.error('Failed to load localStorage data:', error);
    }
  }, []);

  // Auto-migration when cloud becomes available
  useEffect(() => {
    if (isCloudEnabled && !isMigrated && (
      Object.keys(localTemplates).length > 0 || 
      localFrames.length > 0 || 
      Object.keys(localFavorites).length > 0
    )) {
      triggerMigration();
    }
  }, [isCloudEnabled, isMigrated, localTemplates, localFrames, localFavorites]);

  // Convert cloud data to legacy format
  const cloudToLegacyTemplates = useCallback((): Record<string, LegacyPreset> => {
    const result: Record<string, LegacyPreset> = {};
    for (const template of cloudStorage.templates) {
      result[template.id] = {
        title: template.title,
        prompt: template.prompt,
        colors: template.colors,
        referenceImages: template.reference_images?.map(img => img.url || img.r2_key) || []
      };
    }
    return result;
  }, [cloudStorage.templates]);

  const cloudToLegacyFrames = useCallback((cloudImages: typeof cloudStorage.frames): LegacyFrame[] => {
    return cloudImages.map(img => ({
      dataUrl: img.url || '',
      b64: '', // Will be populated when needed
      kind: 'image' as const,
      filename: img.filename,
      hash: img.hash,
      importedAt: new Date(img.created_at).getTime()
    }));
  }, []);

  // Template operations
  const createTemplate = useCallback(async (preset: LegacyPreset): Promise<string> => {
    if (isCloudEnabled) {
      const template = await cloudStorage.createTemplate(preset.title, preset.prompt, preset.colors);
      return template.id;
    } else {
      const id = `custom:${preset.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
      const newTemplates = { ...localTemplates, [id]: preset };
      setLocalTemplates(newTemplates);
      localStorage.setItem('cg_custom_presets_v2', JSON.stringify(newTemplates));
      return id;
    }
  }, [isCloudEnabled, cloudStorage, localTemplates]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<LegacyPreset>): Promise<void> => {
    if (isCloudEnabled) {
      await cloudStorage.updateTemplate(id, updates);
    } else {
      const newTemplates = { 
        ...localTemplates, 
        [id]: { ...localTemplates[id], ...updates } 
      };
      setLocalTemplates(newTemplates);
      localStorage.setItem('cg_custom_presets_v2', JSON.stringify(newTemplates));
    }
  }, [isCloudEnabled, cloudStorage, localTemplates]);

  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    if (isCloudEnabled) {
      await cloudStorage.deleteTemplate(id);
    } else {
      const newTemplates = { ...localTemplates };
      delete newTemplates[id];
      setLocalTemplates(newTemplates);
      localStorage.setItem('cg_custom_presets_v2', JSON.stringify(newTemplates));
    }
  }, [isCloudEnabled, cloudStorage, localTemplates]);

  // Frame operations
  const addFrame = useCallback(async (frame: LegacyFrame): Promise<void> => {
    if (isCloudEnabled && frame.dataUrl) {
      // Convert dataUrl to File and upload
      const file = dataUrlToFile(frame.dataUrl, frame.filename || 'frame.jpg');
      await cloudStorage.uploadFrame(file);
    } else {
      const newFrames = [...localFrames, frame];
      setLocalFrames(newFrames);
      localStorage.setItem('cg_frames_v1', JSON.stringify(newFrames));
    }
  }, [isCloudEnabled, cloudStorage, localFrames]);

  const removeFrame = useCallback(async (index: number): Promise<void> => {
    if (isCloudEnabled) {
      const frame = cloudStorage.frames[index];
      if (frame) {
        await cloudStorage.deleteFrame(frame.id);
      }
    } else {
      const newFrames = localFrames.filter((_, i) => i !== index);
      setLocalFrames(newFrames);
      localStorage.setItem('cg_frames_v1', JSON.stringify(newFrames));
    }
  }, [isCloudEnabled, cloudStorage, localFrames]);

  const addRefFrame = useCallback(async (frame: LegacyFrame): Promise<void> => {
    if (isCloudEnabled && frame.dataUrl) {
      const file = dataUrlToFile(frame.dataUrl, frame.filename || 'ref.jpg');
      await cloudStorage.uploadRefFrame(file);
    } else {
      const newRefFrames = [...localRefFrames, frame];
      setLocalRefFrames(newRefFrames);
      localStorage.setItem('cg_ref_frames_v1', JSON.stringify(newRefFrames));
    }
  }, [isCloudEnabled, cloudStorage, localRefFrames]);

  const removeRefFrame = useCallback(async (index: number): Promise<void> => {
    if (isCloudEnabled) {
      const frame = cloudStorage.refFrames[index];
      if (frame) {
        await cloudStorage.deleteRefFrame(frame.id);
      }
    } else {
      const newRefFrames = localRefFrames.filter((_, i) => i !== index);
      setLocalRefFrames(newRefFrames);
      localStorage.setItem('cg_ref_frames_v1', JSON.stringify(newRefFrames));
    }
  }, [isCloudEnabled, cloudStorage, localRefFrames]);

  // Direct upload methods for files
  const uploadFrame = useCallback(async (file: File): Promise<{ id: string }> => {
    if (isCloudEnabled) {
      const result = await cloudStorage.uploadFrame(file);
      return { id: result.id };
    } else {
      // Convert file to legacy frame format for localStorage
      const dataUrl = await fileToDataUrl(file);
      const frame: LegacyFrame = {
        dataUrl,
        b64: '',
        kind: 'image',
        filename: file.name,
        importedAt: Date.now()
      };
      await addFrame(frame);
      // Return a mock ID for localStorage mode
      return { id: `local-frame-${Date.now()}` };
    }
  }, [isCloudEnabled, cloudStorage, addFrame]);

  const uploadRefFrame = useCallback(async (file: File): Promise<{ id: string }> => {
    if (isCloudEnabled) {
      const result = await cloudStorage.uploadRefFrame(file);
      return { id: result.id };
    } else {
      // Convert file to legacy frame format for localStorage
      const dataUrl = await fileToDataUrl(file);
      const frame: LegacyFrame = {
        dataUrl,
        b64: '',
        kind: 'image',
        filename: file.name,
        importedAt: Date.now()
      };
      await addRefFrame(frame);
      // Return a mock ID for localStorage mode
      return { id: `local-ref-frame-${Date.now()}` };
    }
  }, [isCloudEnabled, cloudStorage, addRefFrame]);

  // Direct delete methods for files
  const deleteFrame = useCallback(async (id: string): Promise<void> => {
    if (isCloudEnabled) {
      await cloudStorage.deleteFrame(id);
    } else {
      // For localStorage mode, we need to find and remove by ID
      // Since localStorage doesn't have IDs, we'll remove the first matching frame
      const newFrames = localFrames.slice(1); // Remove first frame as a fallback
      setLocalFrames(newFrames);
      localStorage.setItem('cg_frames_v1', JSON.stringify(newFrames));
    }
  }, [isCloudEnabled, cloudStorage, localFrames]);

  const deleteRefFrame = useCallback(async (id: string): Promise<void> => {
    if (isCloudEnabled) {
      await cloudStorage.deleteRefFrame(id);
    } else {
      // For localStorage mode, we need to find and remove by ID
      // Since localStorage doesn't have IDs, we'll remove the first matching frame
      const newRefFrames = localRefFrames.slice(1); // Remove first frame as a fallback
      setLocalRefFrames(newRefFrames);
      localStorage.setItem('cg_ref_frames_v1', JSON.stringify(newRefFrames));
    }
  }, [isCloudEnabled, cloudStorage, localRefFrames]);

  // Settings operations
  const updateFavorites = useCallback(async (favorites: Record<string, boolean>): Promise<void> => {
    if (isCloudEnabled) {
      await cloudStorage.updateSettings({ favorites });
    } else {
      setLocalFavorites(favorites);
      localStorage.setItem('cg_style_favs_v2', JSON.stringify(favorites));
    }
  }, [isCloudEnabled, cloudStorage]);

  const updateShowOnlyFavs = useCallback(async (show: boolean): Promise<void> => {
    if (isCloudEnabled) {
      await cloudStorage.updateSettings({ show_only_favs: show });
    } else {
      setLocalShowOnlyFavs(show);
      localStorage.setItem('cg_gallery_only_favs_v1', show ? '1' : '0');
    }
  }, [isCloudEnabled, cloudStorage]);

  // Migration
  const triggerMigration = useCallback(async (): Promise<void> => {
    if (!isCloudEnabled) return;

    try {
      await cloudStorage.migrateFromLocalStorage({
        templates: localTemplates,
        frames: localFrames,
        refFrames: localRefFrames,
        settings: {
          favorites: localFavorites,
          show_only_favs: localShowOnlyFavs
        }
      });

      setIsMigrated(true);
      localStorage.setItem('cg_cloud_migrated', 'true');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }, [isCloudEnabled, cloudStorage, localTemplates, localFrames, localRefFrames, localFavorites, localShowOnlyFavs]);

  const migrateFromLocalStorage = useCallback(async (data: any): Promise<void> => {
    if (!isCloudEnabled) return;
    await cloudStorage.migrateFromLocalStorage(data);
  }, [isCloudEnabled, cloudStorage]);

  // Helper function to convert dataUrl to File
  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const [header, base64Data] = dataUrl.split(',');
    const contentTypeMatch = header.match(/data:([^;]+)/);
    const contentType = contentTypeMatch ? contentTypeMatch[1] : 'image/jpeg';

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new File([bytes], filename, { type: contentType });
  };

  // Helper function to convert File to dataUrl
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Check migration status on load
  useEffect(() => {
    const migrated = localStorage.getItem('cg_cloud_migrated');
    if (migrated === 'true') {
      setIsMigrated(true);
    }
  }, []);

  return {
    // Data (use cloud if available, otherwise localStorage)
    templates: isCloudEnabled ? cloudToLegacyTemplates() : localTemplates,
    frames: isCloudEnabled ? cloudToLegacyFrames(cloudStorage.frames) : localFrames,
    refFrames: isCloudEnabled ? cloudToLegacyFrames(cloudStorage.refFrames) : localRefFrames,
    favorites: isCloudEnabled ? (cloudStorage.settings?.favorites || {}) : localFavorites,
    showOnlyFavs: isCloudEnabled ? (cloudStorage.settings?.show_only_favs || false) : localShowOnlyFavs,
    
    // State
    isCloudEnabled,
    isOnline: cloudStorage.isOnline,
    isLoading: cloudStorage.isLoading,
    isMigrated,
    error: cloudStorage.error,
    
    // Operations
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addFrame,
    removeFrame,
    uploadFrame,
    deleteFrame,
    addRefFrame,
    removeRefFrame,
    uploadRefFrame,
    deleteRefFrame,
    updateFavorites,
    updateShowOnlyFavs,

    // Migration
    triggerMigration,
    migrateFromLocalStorage,
    clearError: cloudStorage.clearError,
  };
}
