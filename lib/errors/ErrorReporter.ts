// Error logging and reporting service

import { AppError, ErrorUtils } from './ErrorTypes';

export interface ErrorReportConfig {
  enableConsoleLogging: boolean;
  enableRemoteReporting: boolean;
  remoteEndpoint?: string;
  maxRetries: number;
  batchSize: number;
  flushInterval: number; // milliseconds
}

export class ErrorReporter {
  private config: ErrorReportConfig;
  private errorQueue: AppError[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ErrorReportConfig>) {
    this.config = {
      enableConsoleLogging: true,
      enableRemoteReporting: process.env.NODE_ENV === 'production',
      remoteEndpoint: '/api/errors',
      maxRetries: 3,
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      ...config,
    };

    // Start periodic flush
    this.startPeriodicFlush();

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  public report(error: AppError): void {
    // Always log to console in development
    if (this.config.enableConsoleLogging || process.env.NODE_ENV === 'development') {
      this.logToConsole(error);
    }

    // Check if error should be reported
    const errorForCheck = error.originalError || new Error(error.message);
    if (!ErrorUtils.shouldReport(errorForCheck)) {
      return;
    }

    // Add to queue for remote reporting
    if (this.config.enableRemoteReporting) {
      this.errorQueue.push(error);

      // Flush immediately for critical errors
      if (error.severity === 'critical') {
        this.flush();
      }
      // Flush when batch size is reached
      else if (this.errorQueue.length >= this.config.batchSize) {
        this.flush();
      }
    }
  }

  public reportError(error: Error, context?: Partial<AppError['context']>): void {
    const appError: AppError = {
      id: this.generateErrorId(),
      message: error.message,
      stack: error.stack,
      severity: ErrorUtils.getSeverity(error),
      category: ErrorUtils.getCategory(error),
      context: {
        timestamp: Date.now(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        ...context,
      },
      recoverable: ErrorUtils.isRecoverable(error),
      originalError: error,
    };

    this.report(appError);
  }

  private logToConsole(error: AppError): void {
    const logMethod = this.getConsoleMethod(error.severity);
    const prefix = `[${error.severity.toUpperCase()}] ${error.category || 'UNKNOWN'}`;
    
    logMethod(`${prefix}: ${error.message}`);
    
    if (error.stack && process.env.NODE_ENV === 'development') {
      console.groupCollapsed('Stack trace');
      console.error(error.stack);
      console.groupEnd();
    }
    
    if (error.context && Object.keys(error.context).length > 0) {
      console.groupCollapsed('Error context');
      console.table(error.context);
      console.groupEnd();
    }
  }

  private getConsoleMethod(severity: AppError['severity']): typeof console.log {
    switch (severity) {
      case 'critical':
      case 'error':
        return console.error;
      case 'warning':
        return console.warn;
      case 'info':
        return console.info;
      default:
        return console.log;
    }
  }

  private async flush(): Promise<void> {
    if (this.errorQueue.length === 0 || !this.config.enableRemoteReporting) {
      return;
    }

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      await this.sendToRemote(errors);
    } catch (reportingError) {
      console.error('Failed to report errors:', reportingError);
      
      // Re-queue errors for retry (up to max retries)
      const retriableErrors = errors.filter(error => 
        (error.context.retryCount || 0) < this.config.maxRetries
      );
      
      retriableErrors.forEach(error => {
        error.context.retryCount = (error.context.retryCount || 0) + 1;
        this.errorQueue.push(error);
      });
    }
  }

  private async sendToRemote(errors: AppError[]): Promise<void> {
    if (!this.config.remoteEndpoint) {
      return;
    }

    const payload = {
      errors,
      metadata: {
        timestamp: Date.now(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        sessionId: this.getSessionId(),
      },
    };

    const response = await fetch(this.config.remoteEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error reporting failed: ${response.status} ${response.statusText}`);
    }
  }

  private startPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSessionId(): string {
    // Try to get session ID from various sources
    if (typeof window !== 'undefined') {
      // Check for existing session ID in sessionStorage
      let sessionId = sessionStorage.getItem('error-reporter-session-id');
      
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('error-reporter-session-id', sessionId);
      }
      
      return sessionId;
    }
    
    return 'unknown';
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Final flush
    this.flush();
  }
}

// Global error reporter instance
let globalErrorReporter: ErrorReporter | null = null;

export function getGlobalErrorReporter(): ErrorReporter {
  if (!globalErrorReporter) {
    globalErrorReporter = new ErrorReporter();
  }
  return globalErrorReporter;
}

export function initializeErrorReporter(config?: Partial<ErrorReportConfig>): ErrorReporter {
  if (globalErrorReporter) {
    globalErrorReporter.destroy();
  }
  
  globalErrorReporter = new ErrorReporter(config);
  
  // Set up global error handlers
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      globalErrorReporter!.reportError(event.error || new Error(event.message), {
        component: 'window',
        additionalData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
        
      globalErrorReporter!.reportError(error, {
        component: 'promise',
        additionalData: {
          type: 'unhandledrejection',
        },
      });
    });
  }
  
  return globalErrorReporter;
}
