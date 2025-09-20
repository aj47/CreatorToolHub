// Middleware orchestrator for worker routes

import { corsMiddleware } from './cors';
import { authMiddleware, AuthenticatedRequest } from './auth';
import { rateLimitMiddleware } from './rateLimit';
import { loggingMiddleware } from './logging';

export type MiddlewareFunction = (
  request: AuthenticatedRequest,
  env: any,
  next: () => Promise<Response>
) => Promise<Response>;

export type RouteHandler = (
  request: AuthenticatedRequest,
  env: any
) => Promise<Response>;

export interface Route {
  pattern: string | RegExp;
  handler: RouteHandler;
  methods?: string[];
}

export class MiddlewareStack {
  private middlewares: MiddlewareFunction[] = [];
  private routes: Route[] = [];

  // Add middleware to the stack
  use(middleware: MiddlewareFunction): this {
    this.middlewares.push(middleware);
    return this;
  }

  // Add a route
  route(pattern: string | RegExp, handler: RouteHandler, methods?: string[]): this {
    this.routes.push({ pattern, handler, methods });
    return this;
  }

  // Process request through middleware stack and routes
  async handle(request: AuthenticatedRequest, env: any): Promise<Response> {
    let middlewareIndex = 0;
    let routeHandler: RouteHandler | null = null;

    // Find matching route
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    for (const route of this.routes) {
      const isMatch = typeof route.pattern === 'string' 
        ? pathname.startsWith(route.pattern)
        : route.pattern.test(pathname);

      const methodMatch = !route.methods || route.methods.includes(method);

      if (isMatch && methodMatch) {
        routeHandler = route.handler;
        break;
      }
    }

    // If no route found, return 404
    if (!routeHandler) {
      return new Response(JSON.stringify({
        error: 'Not Found',
        code: 'ROUTE_NOT_FOUND',
        path: pathname,
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create next function for middleware chain
    const next = async (): Promise<Response> => {
      if (middlewareIndex < this.middlewares.length) {
        const middleware = this.middlewares[middlewareIndex++];
        return middleware(request, env, next);
      } else {
        // All middleware processed, call route handler
        return routeHandler!(request, env);
      }
    };

    // Start middleware chain
    return next();
  }
}

// Create default middleware stack
export function createDefaultMiddlewareStack(): MiddlewareStack {
  const stack = new MiddlewareStack();

  // Add middleware in order (order matters!)
  stack
    .use(loggingMiddleware)    // Log all requests
    .use(corsMiddleware)       // Handle CORS
    .use(rateLimitMiddleware)  // Apply rate limiting
    .use(authMiddleware);      // Handle authentication

  return stack;
}

// Utility function to create a simple route handler
export function createRouteHandler(
  handler: (request: AuthenticatedRequest, env: any) => Promise<Response>
): RouteHandler {
  return async (request: AuthenticatedRequest, env: any): Promise<Response> => {
    try {
      return await handler(request, env);
    } catch (error) {
      console.error('Route handler error:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

// Utility function to create a JSON response
export function jsonResponse(
  data: any,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

// Utility function to create an error response
export function errorResponse(
  message: string,
  status: number = 500,
  code?: string,
  details?: any
): Response {
  return jsonResponse({
    error: message,
    code: code || 'ERROR',
    details,
  }, status);
}

// Export middleware functions for individual use
export {
  corsMiddleware,
  authMiddleware,
  rateLimitMiddleware,
  loggingMiddleware,
};

export type { AuthenticatedRequest };
