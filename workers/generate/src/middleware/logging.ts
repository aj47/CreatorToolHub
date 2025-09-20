// Logging middleware for worker routes

export interface LogContext {
  requestId: string;
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
  startTime: number;
}

export async function loggingMiddleware(
  request: Request,
  env: any,
  next: () => Promise<Response>
): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // Extract request information
  const context: LogContext = {
    requestId,
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('User-Agent') || undefined,
    ip: getClientIP(request),
    startTime,
  };

  // Log request start
  logRequest(context, 'REQUEST_START');

  try {
    // Process the request
    const response = await next();
    
    // Calculate duration
    const duration = Date.now() - startTime;
    
    // Log successful response
    logRequest(context, 'REQUEST_SUCCESS', {
      status: response.status,
      duration,
      contentType: response.headers.get('Content-Type'),
    });

    return response;
  } catch (error) {
    // Calculate duration
    const duration = Date.now() - startTime;
    
    // Log error
    logRequest(context, 'REQUEST_ERROR', {
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Re-throw the error
    throw error;
  }
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getClientIP(request: Request): string | undefined {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         request.headers.get('X-Real-IP') || 
         undefined;
}

function logRequest(
  context: LogContext, 
  event: string, 
  additional?: Record<string, any>
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    requestId: context.requestId,
    event,
    method: context.method,
    url: context.url,
    ip: context.ip,
    userAgent: context.userAgent,
    userId: context.userId,
    ...additional,
  };

  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.log(JSON.stringify(logData, null, 2));
    return;
  }

  // In production, you might want to send to a logging service
  console.log(JSON.stringify(logData));
}

// Helper function to add user context to logs
export function addUserContext(request: any, userId: string): void {
  if (request.logContext) {
    request.logContext.userId = userId;
  }
}

// Helper function to log custom events
export function logEvent(
  context: LogContext,
  event: string,
  data?: Record<string, any>
): void {
  logRequest(context, event, data);
}

// Performance monitoring helper
export function createPerformanceLogger(operation: string) {
  const startTime = Date.now();
  
  return {
    end: (success: boolean = true, metadata?: Record<string, any>) => {
      const duration = Date.now() - startTime;
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'PERFORMANCE',
        operation,
        duration,
        success,
        ...metadata,
      }));
    }
  };
}

// Error logging helper
export function logError(
  error: Error,
  context?: Record<string, any>
): void {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'ERROR',
    message: error.message,
    stack: error.stack,
    ...context,
  }));
}

// Security event logging
export function logSecurityEvent(
  event: string,
  request: Request,
  details?: Record<string, any>
): void {
  console.warn(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'SECURITY',
    type: event,
    ip: getClientIP(request),
    userAgent: request.headers.get('User-Agent'),
    url: request.url,
    method: request.method,
    ...details,
  }));
}
