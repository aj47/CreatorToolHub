// Rate limiting middleware for worker routes

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (in production, use KV or Durable Objects)
const rateLimitStore = new Map<string, RateLimitRecord>();

export async function rateLimitMiddleware(
  request: Request,
  env: any,
  next: () => Promise<Response>
): Promise<Response> {
  const config = getRateLimitConfig(request);
  const key = config.keyGenerator ? config.keyGenerator(request) : getDefaultKey(request);
  
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  // Clean up expired records
  if (record && now > record.resetTime) {
    rateLimitStore.delete(key);
  }
  
  const currentRecord = rateLimitStore.get(key) || {
    count: 0,
    resetTime: now + config.windowMs,
  };
  
  // Check if limit exceeded
  if (currentRecord.count >= config.maxRequests) {
    const retryAfter = Math.ceil((currentRecord.resetTime - now) / 1000);
    
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter,
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.ceil(currentRecord.resetTime / 1000).toString(),
      },
    });
  }
  
  // Process the request
  const response = await next();
  
  // Update rate limit counter based on response
  const shouldCount = shouldCountRequest(response, config);
  if (shouldCount) {
    currentRecord.count++;
    rateLimitStore.set(key, currentRecord);
  }
  
  // Add rate limit headers
  const remaining = Math.max(0, config.maxRequests - currentRecord.count);
  response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(currentRecord.resetTime / 1000).toString());
  
  return response;
}

function getRateLimitConfig(request: Request): RateLimitConfig {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Different limits for different endpoints
  if (pathname.startsWith('/api/generate') || pathname.startsWith('/api/refine')) {
    return {
      windowMs: 60000, // 1 minute
      maxRequests: 10, // 10 generations per minute
    };
  }
  
  if (pathname.startsWith('/api/user/images')) {
    return {
      windowMs: 60000, // 1 minute
      maxRequests: 20, // 20 image operations per minute
    };
  }
  
  // Default rate limit
  return {
    windowMs: 60000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  };
}

function getDefaultKey(request: Request): string {
  // Use IP address if available, otherwise use a default key
  const ip = request.headers.get('CF-Connecting-IP') || 
             request.headers.get('X-Forwarded-For') || 
             request.headers.get('X-Real-IP') || 
             'unknown';
  
  // Include user agent for additional uniqueness
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const userAgentHash = btoa(userAgent).substring(0, 8);
  
  return `${ip}:${userAgentHash}`;
}

function shouldCountRequest(response: Response, config: RateLimitConfig): boolean {
  const isSuccess = response.status >= 200 && response.status < 300;
  const isFailure = response.status >= 400;
  
  if (config.skipSuccessfulRequests && isSuccess) {
    return false;
  }
  
  if (config.skipFailedRequests && isFailure) {
    return false;
  }
  
  return true;
}

// Cleanup function to remove expired records
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Schedule periodic cleanup (call this in worker initialization)
export function startRateLimitCleanup(): void {
  setInterval(cleanupRateLimitStore, 60000); // Clean up every minute
}
