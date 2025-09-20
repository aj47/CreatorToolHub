// Rate limiter implementation for client-side request throttling

export interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
  burstLimit?: number;
}

interface RequestRecord {
  timestamp: number;
  count: number;
}

export class RateLimiter {
  private requests: Map<string, RequestRecord[]> = new Map();
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      burstLimit: config.burstLimit || config.maxRequests,
    };
  }

  async acquire(key: string = 'default'): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get or create request records for this key
    let records = this.requests.get(key) || [];
    
    // Remove old records outside the window
    records = records.filter(record => record.timestamp > windowStart);

    // Count total requests in the current window
    const totalRequests = records.reduce((sum, record) => sum + record.count, 0);

    // Check if we're within limits
    if (totalRequests >= this.config.maxRequests) {
      const oldestRecord = records[0];
      const waitTime = oldestRecord ? (oldestRecord.timestamp + this.config.windowMs) - now : 0;
      
      if (waitTime > 0) {
        await this.delay(waitTime);
        return this.acquire(key); // Retry after waiting
      }
    }

    // Add current request
    const lastRecord = records[records.length - 1];
    if (lastRecord && now - lastRecord.timestamp < 1000) {
      // Group requests within the same second
      lastRecord.count++;
    } else {
      records.push({ timestamp: now, count: 1 });
    }

    // Update records
    this.requests.set(key, records);

    // Clean up old keys periodically
    this.cleanup();
  }

  // Check if a request would be allowed without actually consuming a slot
  canAcquire(key: string = 'default'): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const records = this.requests.get(key) || [];
    const validRecords = records.filter(record => record.timestamp > windowStart);
    const totalRequests = validRecords.reduce((sum, record) => sum + record.count, 0);

    return totalRequests < this.config.maxRequests;
  }

  // Get current usage stats
  getStats(key: string = 'default'): {
    requests: number;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const records = this.requests.get(key) || [];
    const validRecords = records.filter(record => record.timestamp > windowStart);
    const requests = validRecords.reduce((sum, record) => sum + record.count, 0);
    const remaining = Math.max(0, this.config.maxRequests - requests);
    
    // Calculate when the window resets (when the oldest request expires)
    const oldestRecord = validRecords[0];
    const resetTime = oldestRecord ? oldestRecord.timestamp + this.config.windowMs : now;

    return { requests, remaining, resetTime };
  }

  // Reset rate limiter for a specific key
  reset(key?: string): void {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - (this.config.windowMs * 2); // Keep some extra history

    for (const [key, records] of this.requests.entries()) {
      const validRecords = records.filter(record => record.timestamp > cutoff);
      if (validRecords.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRecords);
      }
    }
  }
}

// Predefined rate limiters for common use cases
export const createAPIRateLimiter = () => new RateLimiter({
  maxRequests: 10,
  windowMs: 1000, // 10 requests per second
  burstLimit: 20,
});

export const createSyncRateLimiter = () => new RateLimiter({
  maxRequests: 5,
  windowMs: 5000, // 5 requests per 5 seconds
  burstLimit: 10,
});

export const createUploadRateLimiter = () => new RateLimiter({
  maxRequests: 3,
  windowMs: 10000, // 3 uploads per 10 seconds
  burstLimit: 5,
});
