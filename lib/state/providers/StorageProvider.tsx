"use client";

import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useAppState } from './AppProvider';

// Storage state types
export interface StorageState {
  isOnline: boolean;
  isLoading: boolean;
  lastSync: Date | null;
  error: string | null;
  syncInProgress: boolean;
  pendingOperations: PendingOperation[];
  cacheStatus: {
    templates: CacheStatus;
    images: CacheStatus;
    settings: CacheStatus;
  };
}

export interface PendingOperation {
  id: string;
  type: 'upload' | 'delete' | 'update';
  resource: 'template' | 'image' | 'settings';
  data: any;
  timestamp: number;
  retryCount: number;
}

export interface CacheStatus {
  lastUpdated: Date | null;
  isStale: boolean;
  size: number;
}

export interface StorageContextType {
  state: StorageState;
  dispatch: React.Dispatch<StorageAction>;
  sync: () => Promise<void>;
  clearError: () => void;
  addPendingOperation: (operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>) => void;
  removePendingOperation: (id: string) => void;
  retryPendingOperations: () => Promise<void>;
}

// Action types
export type StorageAction =
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SYNC_IN_PROGRESS'; payload: boolean }
  | { type: 'SET_LAST_SYNC'; payload: Date }
  | { type: 'ADD_PENDING_OPERATION'; payload: PendingOperation }
  | { type: 'REMOVE_PENDING_OPERATION'; payload: string }
  | { type: 'UPDATE_CACHE_STATUS'; payload: { resource: keyof StorageState['cacheStatus']; status: Partial<CacheStatus> } }
  | { type: 'CLEAR_ERROR' };

// Initial state
const initialState: StorageState = {
  isOnline: true,
  isLoading: false,
  lastSync: null,
  error: null,
  syncInProgress: false,
  pendingOperations: [],
  cacheStatus: {
    templates: { lastUpdated: null, isStale: true, size: 0 },
    images: { lastUpdated: null, isStale: true, size: 0 },
    settings: { lastUpdated: null, isStale: true, size: 0 },
  },
};

// Reducer
function storageReducer(state: StorageState, action: StorageAction): StorageState {
  switch (action.type) {
    case 'SET_ONLINE':
      return { ...state, isOnline: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_SYNC_IN_PROGRESS':
      return { ...state, syncInProgress: action.payload };

    case 'SET_LAST_SYNC':
      return { ...state, lastSync: action.payload };

    case 'ADD_PENDING_OPERATION':
      return {
        ...state,
        pendingOperations: [...state.pendingOperations, action.payload],
      };

    case 'REMOVE_PENDING_OPERATION':
      return {
        ...state,
        pendingOperations: state.pendingOperations.filter(op => op.id !== action.payload),
      };

    case 'UPDATE_CACHE_STATUS':
      return {
        ...state,
        cacheStatus: {
          ...state.cacheStatus,
          [action.payload.resource]: {
            ...state.cacheStatus[action.payload.resource],
            ...action.payload.status,
          },
        },
      };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

// Context
const StorageContext = createContext<StorageContextType | undefined>(undefined);

// Hook
export function useStorageState(): StorageContextType {
  const context = useContext(StorageContext);
  if (context === undefined) {
    throw new Error('useStorageState must be used within a StorageProvider');
  }
  return context;
}

// Provider
interface StorageProviderProps {
  children: ReactNode;
}

export function StorageProvider({ children }: StorageProviderProps) {
  const [state, dispatch] = useReducer(storageReducer, initialState);
  const { user } = useAuth();
  const { state: appState } = useAppState();

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE', payload: true });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE', payload: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-retry pending operations when coming back online
  useEffect(() => {
    if (state.isOnline && state.pendingOperations.length > 0) {
      retryPendingOperations();
    }
  }, [state.isOnline]);

  // Sync function
  const sync = async () => {
    if (!user || !appState.features.cloudStorage || state.syncInProgress) {
      return;
    }

    dispatch({ type: 'SET_SYNC_IN_PROGRESS', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      // Implement sync logic here
      // This would call the actual storage service
      
      dispatch({ type: 'SET_LAST_SYNC', payload: new Date() });
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Sync failed' 
      });
    } finally {
      dispatch({ type: 'SET_SYNC_IN_PROGRESS', payload: false });
    }
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Add pending operation
  const addPendingOperation = (operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>) => {
    const pendingOp: PendingOperation = {
      ...operation,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    dispatch({ type: 'ADD_PENDING_OPERATION', payload: pendingOp });
  };

  // Remove pending operation
  const removePendingOperation = (id: string) => {
    dispatch({ type: 'REMOVE_PENDING_OPERATION', payload: id });
  };

  // Retry pending operations
  const retryPendingOperations = async () => {
    if (!state.isOnline || state.pendingOperations.length === 0) {
      return;
    }

    // Process pending operations
    for (const operation of state.pendingOperations) {
      try {
        // Implement retry logic here
        // This would call the actual storage service
        
        removePendingOperation(operation.id);
      } catch (error) {
        console.error('Failed to retry operation:', operation, error);
        // Could implement exponential backoff here
      }
    }
  };

  const value: StorageContextType = {
    state,
    dispatch,
    sync,
    clearError,
    addPendingOperation,
    removePendingOperation,
    retryPendingOperations,
  };

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  );
}
