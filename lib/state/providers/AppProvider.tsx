"use client";

import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { AuthProvider } from '../../auth/AuthProvider';
import { StorageProvider } from './StorageProvider';
import { UIProvider } from './UIProvider';
import { initializeErrorReporter } from '../../errors/ErrorReporter';

// Global app state types
export interface AppState {
  isInitialized: boolean;
  version: string;
  environment: 'development' | 'production';
  features: {
    cloudStorage: boolean;
    autumnIntegration: boolean;
    refinementHistory: boolean;
  };
  performance: {
    requestCount: number;
    lastRequestTime: number;
    averageResponseTime: number;
  };
}

export interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  initialize: () => Promise<void>;
  updateFeatureFlag: (feature: keyof AppState['features'], enabled: boolean) => void;
  recordRequest: (responseTime: number) => void;
}

// Action types for app state
export type AppAction =
  | { type: 'INITIALIZE'; payload: Partial<AppState> }
  | { type: 'UPDATE_FEATURE'; payload: { feature: keyof AppState['features']; enabled: boolean } }
  | { type: 'RECORD_REQUEST'; payload: { responseTime: number } }
  | { type: 'SET_INITIALIZED'; payload: boolean };

// Initial state
const initialState: AppState = {
  isInitialized: false,
  version: '1.0.0',
  environment: process.env.NODE_ENV === 'development' ? 'development' : 'production',
  features: {
    cloudStorage: true,
    autumnIntegration: process.env.NODE_ENV !== 'development',
    refinementHistory: true,
  },
  performance: {
    requestCount: 0,
    lastRequestTime: 0,
    averageResponseTime: 0,
  },
};

// Reducer function
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'INITIALIZE':
      return {
        ...state,
        ...action.payload,
        isInitialized: true,
      };

    case 'UPDATE_FEATURE':
      return {
        ...state,
        features: {
          ...state.features,
          [action.payload.feature]: action.payload.enabled,
        },
      };

    case 'RECORD_REQUEST':
      const newCount = state.performance.requestCount + 1;
      const newAverage = 
        (state.performance.averageResponseTime * state.performance.requestCount + action.payload.responseTime) / newCount;
      
      return {
        ...state,
        performance: {
          requestCount: newCount,
          lastRequestTime: Date.now(),
          averageResponseTime: newAverage,
        },
      };

    case 'SET_INITIALIZED':
      return {
        ...state,
        isInitialized: action.payload,
      };

    default:
      return state;
  }
}

// Context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Hook to use app context
export function useAppState(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppProvider');
  }
  return context;
}

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Initialize app
  const initialize = async () => {
    try {
      // Detect feature availability
      const features = {
        cloudStorage: typeof window !== 'undefined' && 'localStorage' in window,
        autumnIntegration: process.env.NODE_ENV !== 'development',
        refinementHistory: typeof window !== 'undefined' && 'localStorage' in window,
      };

      dispatch({
        type: 'INITIALIZE',
        payload: {
          features,
        },
      });
    } catch (error) {
      console.error('App initialization failed:', error);
      dispatch({ type: 'SET_INITIALIZED', payload: true }); // Initialize anyway
    }
  };

  // Initialize on mount
  useEffect(() => {
    // Initialize error reporting first
    initializeErrorReporter({
      enableConsoleLogging: true,
      enableRemoteReporting: process.env.NODE_ENV === 'production',
    });

    initialize();
  }, []);

  // Update feature flag
  const updateFeatureFlag = (feature: keyof AppState['features'], enabled: boolean) => {
    dispatch({
      type: 'UPDATE_FEATURE',
      payload: { feature, enabled },
    });
  };

  // Record request performance
  const recordRequest = (responseTime: number) => {
    dispatch({
      type: 'RECORD_REQUEST',
      payload: { responseTime },
    });
  };

  const value: AppContextType = {
    state,
    dispatch,
    initialize,
    updateFeatureFlag,
    recordRequest,
  };

  return (
    <AppContext.Provider value={value}>
      <AuthProvider>
        <StorageProvider>
          <UIProvider>
            {children}
          </UIProvider>
        </StorageProvider>
      </AuthProvider>
    </AppContext.Provider>
  );
}
