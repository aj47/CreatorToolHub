export const runtime = "edge";

import { getAuthToken, createAuthToken, createAuthCookie, createInvalidatedToken } from "@/lib/auth";
import { User } from "@/lib/auth/types";

// Environment variables configuration for Cloudflare Pages
// In Cloudflare Pages, environment variables are injected at build/runtime
// We'll try multiple approaches to access them
function getEnvVars() {
  // Try to access environment variables in different ways for Cloudflare Pages
  const getEnvVar = (key: string, fallback: string) => {
    // Try process.env first (might work in some contexts)
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }

    // Try globalThis (Cloudflare Workers/Pages sometimes use this)
    if (typeof globalThis !== 'undefined' && (globalThis as any)[key]) {
      return (globalThis as any)[key];
    }

    // Return fallback
    return fallback;
  };

  return {
    GOOGLE_CLIENT_ID: getEnvVar('GOOGLE_CLIENT_ID', 'your-google-client-id-here'),
    GOOGLE_CLIENT_SECRET: getEnvVar('GOOGLE_CLIENT_SECRET', 'your-google-client-secret-here'),
    NEXTAUTH_URL: getEnvVar('NEXTAUTH_URL', 'https://creatortoolhub.com'),
    NEXTAUTH_SECRET: getEnvVar('NEXTAUTH_SECRET', 'your-secure-nextauth-secret-key-here-32-chars'),
    AUTUMN_SECRET_KEY: getEnvVar('AUTUMN_SECRET_KEY', '***REMOVED***')
  };
}

// Simple Google OAuth implementation for Cloudflare Pages
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const env = getEnvVars();

  // Handle different auth routes
  if (pathname.includes('/signout')) {
    // Redirect to dedicated signout route
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/api/auth/signout' },
    });
  }

  // Handle signin route - redirect to Google OAuth
  if (pathname.includes('/signin')) {
    const clientId = env.GOOGLE_CLIENT_ID;
    const nextAuthUrl = env.NEXTAUTH_URL;

    if (!clientId || clientId === 'your-google-client-id-here') {
      console.error('OAuth configuration error - Google Client ID not configured:', clientId);
      return new Response('OAuth configuration error - Google Client ID not configured', { status: 500 });
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', `${nextAuthUrl}/api/auth/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', 'signin');

    console.log('Redirecting to Google OAuth:', authUrl.toString());
    return new Response(null, {
      status: 302,
      headers: { 'Location': authUrl.toString() },
    });
  }

  if (code && pathname.includes('/callback')) {
    // Handle OAuth callback

    try {
      const clientId = env.GOOGLE_CLIENT_ID;
      const clientSecret = env.GOOGLE_CLIENT_SECRET;
      const nextAuthUrl = env.NEXTAUTH_URL;

      if (!clientId || !clientSecret || clientId === 'your-google-client-id-here' || clientSecret === 'your-google-client-secret-here') {
        return new Response(null, {
          status: 302,
          headers: { 'Location': `${nextAuthUrl}/?error=oauth_config` },
        });
      }

      // Exchange code for token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${nextAuthUrl}/api/auth/callback`,
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.access_token) {
        // Get user info
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const user = await userResponse.json();

        // Validate user data
        if (!user.email) {
          return new Response(null, {
            status: 302,
            headers: { 'Location': `${nextAuthUrl}/?error=no_email` },
          });
        }

        // Create user object and auth token
        const userObj: User = {
          email: user.email,
          name: user.name || '',
          picture: user.picture || '',
        };

        const token = createAuthToken(userObj, 24); // 24 hours
        const isProduction = true; // Always treat as production in Cloudflare Pages
        const cookieOptions = createAuthCookie(token, isProduction);
        const redirectUrl = nextAuthUrl || '/';

        const response = new Response(null, {
          status: 302,
          headers: {
            'Location': redirectUrl,
            'Set-Cookie': cookieOptions,
          },
        });

        return response;
      } else {
        // No access token - redirect with error
        return new Response(null, {
          status: 302,
          headers: { 'Location': `${nextAuthUrl}/?error=no_token` },
        });
      }
    } catch (error) {
      console.error('OAuth error:', error);
    }
  }

  // Default fallback - redirect to home
  return new Response(null, {
    status: 302,
    headers: { 'Location': env.NEXTAUTH_URL || '/' },
  });
}

export async function POST(request: Request) {
  // Redirect POST requests to dedicated signout route
  return new Response(null, {
    status: 302,
    headers: { 'Location': '/api/auth/signout' },
  });
}
