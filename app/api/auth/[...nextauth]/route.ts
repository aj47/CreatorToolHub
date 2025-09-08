export const runtime = "edge";

// Simple Google OAuth implementation for Edge Runtime
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Handle different auth routes
  if (pathname.includes('/signout')) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': process.env.NEXTAUTH_URL || '/',
        'Set-Cookie': 'auth-token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
      },
    });
  }

  if (code && pathname.includes('/callback/google')) {
    // Handle OAuth callback
    try {
      // Exchange code for token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.access_token) {
        // Get user info
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const user = await userResponse.json();

        // Create simple JWT
        const payload = {
          email: user.email,
          name: user.name,
          picture: user.picture,
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
        };

        const token = btoa(JSON.stringify(payload));

        // Set cookie and redirect
        const response = new Response(null, {
          status: 302,
          headers: {
            'Location': process.env.NEXTAUTH_URL || '/',
            'Set-Cookie': `auth-token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`,
          },
        });

        return response;
      }
    } catch (error) {
      console.error('OAuth error:', error);
    }
  }

  // Redirect to Google OAuth
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', `${process.env.NEXTAUTH_URL}/api/auth/callback/google`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', 'signin');

  return new Response(null, {
    status: 302,
    headers: { 'Location': authUrl.toString() },
  });
}

export async function POST(request: Request) {
  // Handle sign out
  return new Response(null, {
    status: 302,
    headers: {
      'Location': process.env.NEXTAUTH_URL || '/',
      'Set-Cookie': 'auth-token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    },
  });
}
