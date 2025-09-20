"use client";

import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// UI state types
export interface UIState {
  loading: {
    global: boolean;
    generation: boolean;
    upload: boolean;
    sync: boolean;
  };
  errors: {
    global: string | null;
    generation: string | null;
    upload: string | null;
    sync: string | null;
  };
  notifications: Notification[];
  modals: {
    isHistoryBrowserOpen: boolean;
    isSettingsOpen: boolean;
    isConfirmDialogOpen: boolean;
    confirmDialog: ConfirmDialogState | null;
  };
  ui: {
    sidebarCollapsed: boolean;
    theme: 'light' | 'dark' | 'auto';
    compactMode: boolean;
  };
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // milliseconds, null for persistent
  timestamp: number;
}

export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'destructive';
}

export interface UIContextType {
  state: UIState;
  dispatch: React.Dispatch<UIAction>;
  
  // Loading states
  setGlobalLoading: (loading: boolean) => void;
  setGenerationLoading: (loading: boolean) => void;
  setUploadLoading: (loading: boolean) => void;
  setSyncLoading: (loading: boolean) => void;
  
  // Error states
  setGlobalError: (error: string | null) => void;
  setGenerationError: (error: string | null) => void;
  setUploadError: (error: string | null) => void;
  setSyncError: (error: string | null) => void;
  clearAllErrors: () => void;
  
  // Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  
  // Modals
  openHistoryBrowser: () => void;
  closeHistoryBrowser: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  showConfirmDialog: (dialog: ConfirmDialogState) => void;
  hideConfirmDialog: () => void;
  
  // UI preferences
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  toggleCompactMode: () => void;
}

// Action types
export type UIAction =
  | { type: 'SET_LOADING'; payload: { key: keyof UIState['loading']; value: boolean } }
  | { type: 'SET_ERROR'; payload: { key: keyof UIState['errors']; value: string | null } }
  | { type: 'CLEAR_ALL_ERRORS' }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_ALL_NOTIFICATIONS' }
  | { type: 'SET_MODAL'; payload: { key: keyof UIState['modals']; value: boolean } }
  | { type: 'SET_CONFIRM_DIALOG'; payload: ConfirmDialogState | null }
  | { type: 'SET_UI_PREFERENCE'; payload: { key: keyof UIState['ui']; value: any } }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_COMPACT_MODE' };

// Initial state
const initialState: UIState = {
  loading: {
    global: false,
    generation: false,
    upload: false,
    sync: false,
  },
  errors: {
    global: null,
    generation: null,
    upload: null,
    sync: null,
  },
  notifications: [],
  modals: {
    isHistoryBrowserOpen: false,
    isSettingsOpen: false,
    isConfirmDialogOpen: false,
    confirmDialog: null,
  },
  ui: {
    sidebarCollapsed: false,
    theme: 'auto',
    compactMode: false,
  },
};

// Reducer
function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.key]: action.payload.value,
        },
      };

    case 'SET_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.key]: action.payload.value,
        },
      };

    case 'CLEAR_ALL_ERRORS':
      return {
        ...state,
        errors: {
          global: null,
          generation: null,
          upload: null,
          sync: null,
        },
      };

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };

    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };

    case 'CLEAR_ALL_NOTIFICATIONS':
      return {
        ...state,
        notifications: [],
      };

    case 'SET_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          [action.payload.key]: action.payload.value,
        },
      };

    case 'SET_CONFIRM_DIALOG':
      return {
        ...state,
        modals: {
          ...state.modals,
          isConfirmDialogOpen: action.payload !== null,
          confirmDialog: action.payload,
        },
      };

    case 'SET_UI_PREFERENCE':
      return {
        ...state,
        ui: {
          ...state.ui,
          [action.payload.key]: action.payload.value,
        },
      };

    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        ui: {
          ...state.ui,
          sidebarCollapsed: !state.ui.sidebarCollapsed,
        },
      };

    case 'TOGGLE_COMPACT_MODE':
      return {
        ...state,
        ui: {
          ...state.ui,
          compactMode: !state.ui.compactMode,
        },
      };

    default:
      return state;
  }
}

// Context
const UIContext = createContext<UIContextType | undefined>(undefined);

// Hook
export function useUI(): UIContextType {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}

// Provider
interface UIProviderProps {
  children: ReactNode;
}

export function UIProvider({ children }: UIProviderProps) {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  // Loading state helpers
  const setGlobalLoading = (loading: boolean) => 
    dispatch({ type: 'SET_LOADING', payload: { key: 'global', value: loading } });
  
  const setGenerationLoading = (loading: boolean) => 
    dispatch({ type: 'SET_LOADING', payload: { key: 'generation', value: loading } });
  
  const setUploadLoading = (loading: boolean) => 
    dispatch({ type: 'SET_LOADING', payload: { key: 'upload', value: loading } });
  
  const setSyncLoading = (loading: boolean) => 
    dispatch({ type: 'SET_LOADING', payload: { key: 'sync', value: loading } });

  // Error state helpers
  const setGlobalError = (error: string | null) => 
    dispatch({ type: 'SET_ERROR', payload: { key: 'global', value: error } });
  
  const setGenerationError = (error: string | null) => 
    dispatch({ type: 'SET_ERROR', payload: { key: 'generation', value: error } });
  
  const setUploadError = (error: string | null) => 
    dispatch({ type: 'SET_ERROR', payload: { key: 'upload', value: error } });
  
  const setSyncError = (error: string | null) => 
    dispatch({ type: 'SET_ERROR', payload: { key: 'sync', value: error } });
  
  const clearAllErrors = () => dispatch({ type: 'CLEAR_ALL_ERRORS' });

  // Notification helpers
  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const fullNotification: Notification = {
      ...notification,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    dispatch({ type: 'ADD_NOTIFICATION', payload: fullNotification });
    
    // Auto-remove notification after duration
    if (notification.duration !== null) {
      const duration = notification.duration || 5000;
      setTimeout(() => {
        removeNotification(fullNotification.id);
      }, duration);
    }
  };
  
  const removeNotification = (id: string) => 
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  
  const clearAllNotifications = () => dispatch({ type: 'CLEAR_ALL_NOTIFICATIONS' });

  // Modal helpers
  const openHistoryBrowser = () => 
    dispatch({ type: 'SET_MODAL', payload: { key: 'isHistoryBrowserOpen', value: true } });
  
  const closeHistoryBrowser = () => 
    dispatch({ type: 'SET_MODAL', payload: { key: 'isHistoryBrowserOpen', value: false } });
  
  const openSettings = () => 
    dispatch({ type: 'SET_MODAL', payload: { key: 'isSettingsOpen', value: true } });
  
  const closeSettings = () => 
    dispatch({ type: 'SET_MODAL', payload: { key: 'isSettingsOpen', value: false } });
  
  const showConfirmDialog = (dialog: ConfirmDialogState) => 
    dispatch({ type: 'SET_CONFIRM_DIALOG', payload: dialog });
  
  const hideConfirmDialog = () => 
    dispatch({ type: 'SET_CONFIRM_DIALOG', payload: null });

  // UI preference helpers
  const toggleSidebar = () => dispatch({ type: 'TOGGLE_SIDEBAR' });
  
  const setTheme = (theme: 'light' | 'dark' | 'auto') => 
    dispatch({ type: 'SET_UI_PREFERENCE', payload: { key: 'theme', value: theme } });
  
  const toggleCompactMode = () => dispatch({ type: 'TOGGLE_COMPACT_MODE' });

  const value: UIContextType = {
    state,
    dispatch,
    setGlobalLoading,
    setGenerationLoading,
    setUploadLoading,
    setSyncLoading,
    setGlobalError,
    setGenerationError,
    setUploadError,
    setSyncError,
    clearAllErrors,
    addNotification,
    removeNotification,
    clearAllNotifications,
    openHistoryBrowser,
    closeHistoryBrowser,
    openSettings,
    closeSettings,
    showConfirmDialog,
    hideConfirmDialog,
    toggleSidebar,
    setTheme,
    toggleCompactMode,
  };

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
}
