export const runtime = "edge";

import { getAuthToken, createInvalidatedToken, createSignOutCookie } from "@/lib/auth";

// Environment variables configuration for Cloudflare Pages
function getEnvVars() {
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
    NEXTAUTH_URL: getEnvVar('NEXTAUTH_URL', 'https://creatortoolhub.com')
  };
}

export async function POST(request: Request) {
  try {
    const env = getEnvVars();
    const isProduction = true; // Always treat as production in Cloudflare Pages
    const nextAuthUrl = env.NEXTAUTH_URL || '/';
    
    // Get current token to invalidate it
    const token = getAuthToken(request);
    
    if (token) {
      // Create an invalidated version of the token
      const invalidatedToken = createInvalidatedToken(token);
      
      // Set the invalidated token as a cookie (this marks it as signed out)
      const invalidatedCookie = `auth-token=${invalidatedToken}; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=${isProduction ? 'None' : 'Lax'}; Path=/; Max-Age=86400`;
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Signed out successfully' 
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': invalidatedCookie,
        },
      });
    } else {
      // No token found, but still return success
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Already signed out' 
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (error) {
    console.error('Sign out error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Sign out failed' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

// Also handle GET requests for backward compatibility
export async function GET(request: Request) {
  const env = getEnvVars();
  const isProduction = true; // Always treat as production in Cloudflare Pages
  const nextAuthUrl = env.NEXTAUTH_URL || '/';
  
  // Clear the auth cookie and redirect
  const signOutCookie = createSignOutCookie(isProduction);
  
  return new Response(null, {
    status: 302,
    headers: {
      'Location': nextAuthUrl,
      'Set-Cookie': signOutCookie,
    },
  });
}
