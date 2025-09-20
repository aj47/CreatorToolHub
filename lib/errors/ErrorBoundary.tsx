"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorReporter } from './ErrorReporter';
import { ErrorRecovery } from './ErrorRecovery';
import { AppError, ErrorSeverity } from './ErrorTypes';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'app' | 'page' | 'component';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private errorReporter: ErrorReporter;
  private errorRecovery: ErrorRecovery;

  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    };

    this.errorReporter = new ErrorReporter();
    this.errorRecovery = new ErrorRecovery();
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.generateErrorId();
    
    this.setState({
      errorInfo,
      errorId,
    });

    // Create structured error object
    const appError: AppError = {
      id: errorId,
      message: error.message,
      stack: error.stack,
      severity: this.determineSeverity(error),
      context: {
        component: errorInfo.componentStack || undefined,
        level: this.props.level || 'component',
        retryCount: this.state.retryCount,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      },
      recoverable: this.errorRecovery.isRecoverable(error),
    };

    // Report the error
    this.errorReporter.report(appError);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Attempt automatic recovery for recoverable errors
    if (appError.recoverable && this.state.retryCount < 3) {
      this.attemptRecovery(error);
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineSeverity(error: Error): ErrorSeverity {
    // Network errors are usually recoverable
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'warning';
    }

    // Chunk loading errors (common in development)
    if (error.message.includes('Loading chunk') || error.message.includes('ChunkLoadError')) {
      return 'warning';
    }

    // Authentication errors
    if (error.message.includes('auth') || error.message.includes('unauthorized')) {
      return 'error';
    }

    // Default to error for unknown issues
    return 'error';
  }

  private attemptRecovery = async (error: Error) => {
    try {
      const recovered = await this.errorRecovery.recover(error);
      
      if (recovered) {
        // Reset error state after successful recovery
        setTimeout(() => {
          this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null,
            retryCount: this.state.retryCount + 1,
          });
        }, 1000);
      }
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
    }
  };

  private handleRetry = () => {
    if (this.state.retryCount < 3) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        retryCount: this.state.retryCount + 1,
      });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.state.errorInfo!);
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-boundary__container">
            <div className="error-boundary__icon">⚠️</div>
            <h2 className="error-boundary__title">Something went wrong</h2>
            
            <p className="error-boundary__message">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>

            {this.state.errorId && (
              <p className="error-boundary__error-id">
                Error ID: <code>{this.state.errorId}</code>
              </p>
            )}

            <div className="error-boundary__actions">
              {this.state.retryCount < 3 && (
                <button 
                  onClick={this.handleRetry}
                  className="error-boundary__button error-boundary__button--primary"
                >
                  Try Again ({3 - this.state.retryCount} attempts left)
                </button>
              )}
              
              <button 
                onClick={this.handleReload}
                className="error-boundary__button error-boundary__button--secondary"
              >
                Reload Page
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="error-boundary__details">
                <summary>Error Details (Development)</summary>
                <pre className="error-boundary__stack">
                  {this.state.error?.stack}
                </pre>
                <pre className="error-boundary__component-stack">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Specialized error boundaries for different contexts
export const AppErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary level="app">
    {children}
  </ErrorBoundary>
);

export const PageErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary level="page">
    {children}
  </ErrorBoundary>
);

export const ComponentErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary level="component">
    {children}
  </ErrorBoundary>
);
