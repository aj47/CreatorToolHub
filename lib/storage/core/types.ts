// Core storage type definitions

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  clear(): Promise<void>;
}

export interface SyncStatus {
  inProgress: boolean;
  lastSync: number;
  error?: string;
}

export interface StorageState {
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;
  lastSync: number;
}

export interface StorageConfig {
  enableCloud: boolean;
  enableLocal: boolean;
  syncInterval: number;
  retryAttempts: number;
  retryDelay: number;
}

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

// Modern storage types
export interface StorageTemplate {
  id: string;
  title: string;
  prompt: string;
  colors: string[];
  referenceImages: string[];
  createdAt: number;
  updatedAt: number;
}

export interface StorageFrame {
  id: string;
  filename: string;
  dataUrl?: string;
  url?: string;
  type: 'frame' | 'reference';
  size: number;
  hash?: string;
  createdAt: number;
}

export interface StorageSettings {
  favorites: Record<string, boolean>;
  showOnlyFavs: boolean;
  lastSync: number;
}

export interface StorageData {
  templates: Record<string, StorageTemplate>;
  frames: Record<string, StorageFrame>;
  settings: StorageSettings;
}

// Sync operation types
export type SyncDirection = 'up' | 'down' | 'both';

export interface SyncOperation {
  key: string;
  direction: SyncDirection;
  priority: number;
  timestamp: number;
}

// Error types
export enum StorageErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export interface StorageError {
  type: StorageErrorType;
  message: string;
  code?: string;
  recoverable: boolean;
  retryAfter?: number;
}
