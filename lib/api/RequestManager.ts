// Centralized request handling with throttling, deduplication, and circuit breaker

import { CircuitBreaker } from './CircuitBreaker';
import { RateLimiter } from './RateLimiter';

export interface RequestConfig {
  priority?: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  deduplicationKey?: string;
}

export interface RequestStats {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  circuitBreakerState: string;
  rateLimiterStats: any;
}

export class RequestManager {
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private requestQueue: Array<{
    key: string;
    operation: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    config: RequestConfig;
    timestamp: number;
  }> = [];
  private processing = false;
  private stats = {
    total: 0,
    successful: 0,
    failed: 0,
    pending: 0,
  };

  constructor(
    circuitBreaker?: CircuitBreaker,
    rateLimiter?: RateLimiter
  ) {
    this.circuitBreaker = circuitBreaker || new CircuitBreaker();
    this.rateLimiter = rateLimiter || new RateLimiter({
      maxRequests: 10,
      windowMs: 1000,
    });

    // Start processing queue
    this.processQueue();
  }

  async execute<T>(
    operation: () => Promise<T>,
    config: RequestConfig = {}
  ): Promise<T> {
    const key = config.deduplicationKey || this.generateKey(operation);
    
    // Check for duplicate requests
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    // Create promise for this request
    const promise = new Promise<T>((resolve, reject) => {
      this.requestQueue.push({
        key,
        operation,
        resolve,
        reject,
        config,
        timestamp: Date.now(),
      });

      // Sort queue by priority (higher priority first)
      this.requestQueue.sort((a, b) => (b.config.priority || 0) - (a.config.priority || 0));
    });

    this.pendingRequests.set(key, promise);
    this.stats.total++;
    this.stats.pending++;

    // Clean up after completion
    promise.finally(() => {
      this.pendingRequests.delete(key);
      this.stats.pending--;
    });

    return promise;
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) continue;

      try {
        // Apply rate limiting
        await this.rateLimiter.acquire(request.key);

        // Execute with circuit breaker
        const result = await this.circuitBreaker.execute(async () => {
          return await this.executeWithRetry(request.operation, request.config);
        });

        request.resolve(result);
        this.stats.successful++;
      } catch (error) {
        request.reject(error);
        this.stats.failed++;
      }
    }

    this.processing = false;

    // Schedule next processing cycle
    setTimeout(() => this.processQueue(), 100);
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RequestConfig
  ): Promise<T> {
    const maxRetries = config.retries || 3;
    const baseDelay = config.retryDelay || 1000;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Apply timeout if specified
        if (config.timeout) {
          return await this.withTimeout(operation(), config.timeout);
        } else {
          return await operation();
        }
      } catch (error) {
        lastError = error;

        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Don't retry certain types of errors
        if (this.isNonRetryableError(error)) {
          break;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeoutId));
    });
  }

  private isNonRetryableError(error: any): boolean {
    // Don't retry client errors (4xx) except for specific cases
    if (error.status >= 400 && error.status < 500) {
      // Retry on 408 (timeout), 429 (rate limit), and 503 (service unavailable)
      return ![408, 429, 503].includes(error.status);
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateKey(operation: () => Promise<any>): string {
    // Generate a simple key based on the operation string
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for monitoring and control
  getStats(): RequestStats {
    return {
      ...this.stats,
      circuitBreakerState: this.circuitBreaker.getState(),
      rateLimiterStats: this.rateLimiter.getStats(),
    };
  }

  clearQueue(): void {
    this.requestQueue.forEach(request => {
      request.reject(new Error('Request queue cleared'));
    });
    this.requestQueue = [];
    this.pendingRequests.clear();
  }

  reset(): void {
    this.clearQueue();
    this.circuitBreaker.reset();
    this.rateLimiter.reset();
    this.stats = {
      total: 0,
      successful: 0,
      failed: 0,
      pending: 0,
    };
  }
}

// Global request manager instance
let globalRequestManager: RequestManager | null = null;

export function getRequestManager(): RequestManager {
  if (!globalRequestManager) {
    globalRequestManager = new RequestManager();
  }
  return globalRequestManager;
}
