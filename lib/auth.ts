// Enhanced auth utilities for Edge Runtime
import { AuthToken, User, AuthError } from './auth/types';

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

function encodeAuthPayload(payload: AuthToken): string {
  const json = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeAuthPayload(token: string): AuthToken | null {
  try {
    const binary = atob(token);

    // First, try to interpret as UTF-8 encoded JSON (new scheme)
    try {
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decoder = new TextDecoder();
      const json = decoder.decode(bytes);
      return JSON.parse(json) as AuthToken;
    } catch {
      // Fallback for legacy tokens where atob(token) returned the JSON string directly
      return JSON.parse(binary) as AuthToken;
    }
  } catch {
    return null;
  }
}

export function verifyAuthToken(token: string): User | null {
  const payload = decodeAuthPayload(token);
  if (!payload) return null;

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
}

export function getUser(request: Request): User | null {
  const token = getAuthToken(request);
  if (!token) return null;
  return verifyAuthToken(token);
}

export function createAuthToken(user: User, expiresInHours: number = 24): string {
  const payload: AuthToken = {
    email: user.email,
    name: user.name,
    picture: user.picture,
    exp: Math.floor(Date.now() / 1000) + (expiresInHours * 60 * 60),
  };

  return encodeAuthPayload(payload);
}

export function createInvalidatedToken(token: string): string {
  const payload = decodeAuthPayload(token);
  if (!payload) {
    // If token is invalid, return a dummy invalidated token
    return encodeAuthPayload({
      email: '',
      name: '',
      picture: '',
      exp: 0,
      signOutAfter: Math.floor(Date.now() / 1000),
    });
  }

  const invalidatedPayload: AuthToken = {
    ...payload,
    signOutAfter: Math.floor(Date.now() / 1000),
  };
  return encodeAuthPayload(invalidatedPayload);
}

export function createAuthCookie(token: string, isProduction: boolean = false): string {
  // Use secure settings for production, relaxed for development
  const secure = isProduction ? 'Secure; ' : '';
  const sameSite = isProduction ? 'None' : 'Lax';

  return `auth-token=${token}; HttpOnly; ${secure}SameSite=${sameSite}; Path=/; Max-Age=86400`;
}

export function createSignOutCookie(isProduction: boolean = false): string {
  // Create an expired cookie to clear the auth token
  const secure = isProduction ? 'Secure; ' : '';
  const sameSite = isProduction ? 'None' : 'Lax';

  return `auth-token=; HttpOnly; ${secure}SameSite=${sameSite}; Path=/; Max-Age=0`;
}
