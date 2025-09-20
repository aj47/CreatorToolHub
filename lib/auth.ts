// Simple auth utilities for Edge Runtime
export function getAuthToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  
  return cookies['auth-token'] || null;
}

export function verifyAuthToken(token: string): { email: string; name: string; picture: string } | null {
  try {
    const payload = JSON.parse(atob(token));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    // Check if token was created before a global sign out time
    // This provides server-side session invalidation
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

export function getUser(request: Request) {
  const token = getAuthToken(request);
  if (!token) return null;
  return verifyAuthToken(token);
}
