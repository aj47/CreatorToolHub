export const runtime = "edge";

// Simple Google OAuth implementation for Edge Runtime
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');



  // Handle different auth routes
  if (pathname.includes('/signout')) {
    const isProduction = process.env.NODE_ENV === 'production';
    const domain = isProduction ? '; Domain=.creatortoolhub.com' : '';
    const cookieOptions = `auth-token=; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=None${domain}; Path=/; Max-Age=0`;

    return new Response(null, {
      status: 302,
      headers: {
        'Location': process.env.NEXTAUTH_URL || '/',
        'Set-Cookie': cookieOptions,
      },
    });
  }

  // Handle signin route - redirect to Google OAuth
  if (pathname.includes('/signin')) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const nextAuthUrl = process.env.NEXTAUTH_URL;



    if (!clientId) {
      return new Response('OAuth configuration error', { status: 500 });
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', `${nextAuthUrl}/api/auth/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', 'signin');



    return new Response(null, {
      status: 302,
      headers: { 'Location': authUrl.toString() },
    });
  }

  if (code && pathname.includes('/callback')) {
    // Handle OAuth callback

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const nextAuthUrl = process.env.NEXTAUTH_URL;

      if (!clientId || !clientSecret) {
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

        // Create simple JWT
        const payload = {
          email: user.email,
          name: user.name,
          picture: user.picture,
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
        };

        const token = btoa(JSON.stringify(payload));

        // Set cookie and redirect
        const isProduction = process.env.NODE_ENV === 'production';
        // Use domain that allows subdomain access for worker authentication
        const domain = isProduction ? '; Domain=.creatortoolhub.com' : '';
        const cookieOptions = `auth-token=${token}; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=None${domain}; Path=/; Max-Age=86400`;
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
    headers: { 'Location': process.env.NEXTAUTH_URL || '/' },
  });
}

export async function POST(request: Request) {
  // Handle sign out
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = isProduction ? '; Domain=.creatortoolhub.com' : '';
  const cookieOptions = `auth-token=; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=None${domain}; Path=/; Max-Age=0`;

  return new Response(null, {
    status: 302,
    headers: {
      'Location': process.env.NEXTAUTH_URL || '/',
      'Set-Cookie': cookieOptions,
    },
  });
}
