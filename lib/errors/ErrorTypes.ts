// Comprehensive error type definitions

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export type ErrorCategory = 
  | 'network'
  | 'authentication' 
  | 'authorization'
  | 'validation'
  | 'storage'
  | 'generation'
  | 'ui'
  | 'system'
  | 'unknown';

export interface ErrorContext {
  component?: string;
  level?: 'app' | 'page' | 'component';
  retryCount?: number;
  timestamp: number;
  userAgent?: string;
  url?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  additionalData?: Record<string, any>;
}

export interface AppError {
  id: string;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  category?: ErrorCategory;
  context: ErrorContext;
  recoverable: boolean;
  originalError?: Error;
}

// Specific error types
export class NetworkError extends Error {
  public readonly category = 'network';
  public readonly recoverable = true;
  
  constructor(
    message: string,
    public readonly status?: number,
    public readonly url?: string
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends Error {
  public readonly category = 'authentication';
  public readonly recoverable = false;
  
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  public readonly category = 'authorization';
  public readonly recoverable = false;
  
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends Error {
  public readonly category = 'validation';
  public readonly recoverable = true;
  
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class StorageError extends Error {
  public readonly category = 'storage';
  public readonly recoverable = true;
  
  constructor(
    message: string,
    public readonly operation?: 'read' | 'write' | 'delete' | 'sync'
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export class GenerationError extends Error {
  public readonly category = 'generation';
  public readonly recoverable = true;
  
  constructor(
    message: string,
    public readonly stage?: 'request' | 'processing' | 'response',
    public readonly creditsUsed?: number
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

export class UIError extends Error {
  public readonly category = 'ui';
  public readonly recoverable = true;
  
  constructor(
    message: string,
    public readonly component?: string
  ) {
    super(message);
    this.name = 'UIError';
  }
}

export class SystemError extends Error {
  public readonly category = 'system';
  public readonly recoverable = false;
  
  constructor(message: string) {
    super(message);
    this.name = 'SystemError';
  }
}

// Error factory functions
export const ErrorFactory = {
  network: (message: string, status?: number, url?: string) => 
    new NetworkError(message, status, url),
    
  authentication: (message?: string) => 
    new AuthenticationError(message),
    
  authorization: (message?: string) => 
    new AuthorizationError(message),
    
  validation: (message: string, field?: string, value?: any) => 
    new ValidationError(message, field, value),
    
  storage: (message: string, operation?: 'read' | 'write' | 'delete' | 'sync') => 
    new StorageError(message, operation),
    
  generation: (message: string, stage?: 'request' | 'processing' | 'response', creditsUsed?: number) => 
    new GenerationError(message, stage, creditsUsed),
    
  ui: (message: string, component?: string) => 
    new UIError(message, component),
    
  system: (message: string) => 
    new SystemError(message),
};

// Error classification utilities
export const ErrorUtils = {
  isRecoverable: (error: Error): boolean => {
    if ('recoverable' in error) {
      return (error as any).recoverable;
    }
    
    // Default classification based on error type
    if (error instanceof NetworkError) return true;
    if (error instanceof ValidationError) return true;
    if (error instanceof StorageError) return true;
    if (error instanceof GenerationError) return true;
    if (error instanceof UIError) return true;
    
    return false;
  },
  
  getCategory: (error: Error): ErrorCategory => {
    if ('category' in error) {
      return (error as any).category;
    }
    
    // Classify based on error message patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return 'network';
    }
    if (message.includes('auth') || message.includes('login') || message.includes('unauthorized')) {
      return 'authentication';
    }
    if (message.includes('permission') || message.includes('forbidden') || message.includes('access')) {
      return 'authorization';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return 'validation';
    }
    if (message.includes('storage') || message.includes('localStorage') || message.includes('database')) {
      return 'storage';
    }
    if (message.includes('generation') || message.includes('gemini') || message.includes('credits')) {
      return 'generation';
    }
    
    return 'unknown';
  },
  
  getSeverity: (error: Error): ErrorSeverity => {
    const category = ErrorUtils.getCategory(error);
    
    switch (category) {
      case 'system':
        return 'critical';
      case 'authentication':
      case 'authorization':
        return 'error';
      case 'network':
      case 'storage':
        return 'warning';
      case 'validation':
      case 'ui':
        return 'info';
      default:
        return 'error';
    }
  },
  
  shouldReport: (error: Error): boolean => {
    const severity = ErrorUtils.getSeverity(error);
    
    // Don't report info-level errors in production
    if (process.env.NODE_ENV === 'production' && severity === 'info') {
      return false;
    }
    
    // Always report critical and error-level issues
    if (severity === 'critical' || severity === 'error') {
      return true;
    }
    
    // Report warnings in development
    if (process.env.NODE_ENV === 'development' && severity === 'warning') {
      return true;
    }
    
    return false;
  },
};
