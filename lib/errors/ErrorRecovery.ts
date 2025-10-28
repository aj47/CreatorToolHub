// Automatic error recovery strategies

import { ErrorUtils, NetworkError, StorageError, GenerationError } from './ErrorTypes';

export interface RecoveryStrategy {
  canRecover(error: Error): boolean;
  recover(error: Error): Promise<boolean>;
  priority: number; // Lower numbers = higher priority
}

export class ErrorRecovery {
  private strategies: RecoveryStrategy[] = [];

  constructor() {
    this.registerDefaultStrategies();
  }

  public registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
    // Sort by priority (lower numbers first)
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  public isRecoverable(error: Error): boolean {
    return this.strategies.some(strategy => strategy.canRecover(error));
  }

  public async recover(error: Error): Promise<boolean> {
    for (const strategy of this.strategies) {
      if (strategy.canRecover(error)) {
        try {
          const recovered = await strategy.recover(error);
          if (recovered) {
            return true;
          }
        } catch (recoveryError) {
        }
      }
    }
    
    return false;
  }

  private registerDefaultStrategies(): void {
    this.registerStrategy(new NetworkRetryStrategy());
    this.registerStrategy(new ChunkLoadingStrategy());
    this.registerStrategy(new StorageRecoveryStrategy());
    this.registerStrategy(new AuthenticationRecoveryStrategy());
    this.registerStrategy(new GenerationRecoveryStrategy());
  }
}

// Network retry strategy
class NetworkRetryStrategy implements RecoveryStrategy {
  public priority = 1;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  canRecover(error: Error): boolean {
    return error instanceof NetworkError || 
           error.message.includes('fetch') ||
           error.message.includes('network') ||
           error.message.includes('timeout');
  }

  async recover(error: Error): Promise<boolean> {
    // For network errors, we can't automatically retry the original request
    // but we can check if the network is back online
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      if (!navigator.onLine) {
        // Wait for network to come back online
        return new Promise((resolve) => {
          const handleOnline = () => {
            window.removeEventListener('online', handleOnline);
            resolve(true);
          };
          window.addEventListener('online', handleOnline);
          
          // Timeout after 30 seconds
          setTimeout(() => {
            window.removeEventListener('online', handleOnline);
            resolve(false);
          }, 30000);
        });
      }
    }
    
    // If we're online, wait a bit and assume recovery
    await this.delay(this.retryDelay);
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Chunk loading error recovery
class ChunkLoadingStrategy implements RecoveryStrategy {
  public priority = 2;

  canRecover(error: Error): boolean {
    return error.message.includes('Loading chunk') ||
           error.message.includes('ChunkLoadError') ||
           error.name === 'ChunkLoadError';
  }

  async recover(error: Error): Promise<boolean> {
    // For chunk loading errors, reload the page
    if (typeof window !== 'undefined') {
      // Give a small delay to avoid immediate reload loops
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return true;
    }
    return false;
  }
}

// Storage recovery strategy
class StorageRecoveryStrategy implements RecoveryStrategy {
  public priority = 3;

  canRecover(error: Error): boolean {
    return error instanceof StorageError ||
           error.message.includes('localStorage') ||
           error.message.includes('storage') ||
           error.message.includes('quota');
  }

  async recover(error: Error): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      // Check if localStorage is available
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      
      // If we get here, localStorage is working
      return true;
    } catch (storageError) {
      // Try to clear some space
      try {
        this.clearOldStorageData();
        return true;
      } catch (clearError) {
        return false;
      }
    }
  }

  private clearOldStorageData(): void {
    if (typeof window === 'undefined') return;

    // Clear old refinement histories (keep only recent ones)
    try {
      const histories = localStorage.getItem('thumbnail_refinement_histories');
      if (histories) {
        const parsed = JSON.parse(histories);
        if (Array.isArray(parsed) && parsed.length > 10) {
          // Keep only the 10 most recent
          const recent = parsed
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, 10);
          localStorage.setItem('thumbnail_refinement_histories', JSON.stringify(recent));
        }
      }
    } catch (error) {
    }

    // Clear other old data
    const keysToCheck = [
      'thumbnail_templates',
      'thumbnail_frames',
      'thumbnail_settings',
    ];

    keysToCheck.forEach(key => {
      try {
        const data = localStorage.getItem(key);
        if (data && data.length > 100000) { // If larger than 100KB
          localStorage.removeItem(key);
        }
      } catch (error) {
      }
    });
  }
}

// Authentication recovery strategy
class AuthenticationRecoveryStrategy implements RecoveryStrategy {
  public priority = 4;

  canRecover(error: Error): boolean {
    return error.message.includes('auth') ||
           error.message.includes('unauthorized') ||
           error.message.includes('401');
  }

  async recover(error: Error): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      // Try to refresh the session
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        return data.authenticated === true;
      }

      // If session refresh fails, redirect to sign in
      if (response.status === 401) {
        window.location.href = '/api/auth/signin';
        return true; // Consider this a recovery since we're handling it
      }

      return false;
    } catch (sessionError) {
      return false;
    }
  }
}

// Generation error recovery strategy
class GenerationRecoveryStrategy implements RecoveryStrategy {
  public priority = 5;

  canRecover(error: Error): boolean {
    return error instanceof GenerationError ||
           error.message.includes('generation') ||
           error.message.includes('gemini') ||
           error.message.includes('quota');
  }

  async recover(error: Error): Promise<boolean> {
    // For generation errors, we can't automatically retry
    // but we can check if the service is available
    try {
      const response = await fetch('/api/generate', {
        method: 'GET',
      });

      // If the endpoint responds, consider it recovered
      return response.status !== 500;
    } catch (checkError) {
      return false;
    }
  }
}

// Export default instance
export const defaultErrorRecovery = new ErrorRecovery();
