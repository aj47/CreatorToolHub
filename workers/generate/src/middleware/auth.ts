// Authentication middleware for worker routes

// Simple auth utilities for Edge Runtime (copied from lib/auth.ts)
function getAuthToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  return cookies['auth-token'] || null;
}

function verifyAuthToken(token: string): { email: string; name: string; picture: string } | null {
  try {
    const payload = JSON.parse(atob(token));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    // Check if token was created before a global sign out time
    if (payload.signOutAfter && payload.signOutAfter < Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (payload.email) {
      return {
        email: payload.email,
        name: payload.name || '',
        picture: payload.picture || '',
      };
    }

    return null;
  } catch {
    return null;
  }
}

function getUser(request: Request): { email: string; name: string; picture: string } | null {
  const token = getAuthToken(request);
  if (!token) return null;
  return verifyAuthToken(token);
}

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    name: string;
    picture: string;
  };
}

export interface MiddlewareContext {
  request: AuthenticatedRequest;
  env: any;
  next: () => Promise<Response>;
}

export async function authMiddleware(
  request: AuthenticatedRequest,
  env: any,
  next: () => Promise<Response>
): Promise<Response> {
  try {
    // Extract user from request cookies
    const user = getUser(request);
    
    // Attach user to request for downstream handlers
    if (user) {
      request.user = user;
    }

    // Check if route requires authentication
    const url = new URL(request.url);
    const requiresAuth = shouldRequireAuth(url.pathname);

    if (requiresAuth && !user) {
      return new Response(JSON.stringify({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Continue to next middleware/handler
    return await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return new Response(JSON.stringify({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

function shouldRequireAuth(pathname: string): boolean {
  // Routes that require authentication
  const protectedRoutes = [
    '/api/user/',
    '/api/generate',
    '/api/refine',
  ];

  return protectedRoutes.some(route => pathname.startsWith(route));
}

// Helper function to get user ID from authenticated request
export function getUserId(request: AuthenticatedRequest): string | null {
  if (!request.user?.email) {
    return null;
  }
  
  // Create a consistent user ID from email
  return btoa(request.user.email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
}

// Helper function to ensure user is authenticated
export function requireAuth(request: AuthenticatedRequest): {
  email: string;
  name: string;
  picture: string;
} {
  if (!request.user) {
    throw new Error('User not authenticated');
  }
  return request.user;
}
