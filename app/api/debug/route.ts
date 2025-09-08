export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieHeader = request.headers.get('cookie');
  
  // Parse cookies
  const cookies = cookieHeader ? cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>) : {};
  
  const authToken = cookies['auth-token'];
  let tokenPayload = null;
  let tokenValid = false;
  
  if (authToken) {
    try {
      tokenPayload = JSON.parse(atob(authToken));
      tokenValid = tokenPayload.exp && tokenPayload.exp > Math.floor(Date.now() / 1000);
    } catch (error) {
      // Invalid token
    }
  }
  
  const debugInfo = {
    timestamp: new Date().toISOString(),
    url: url.toString(),
    hasAuthToken: !!authToken,
    tokenValid,
    tokenPayload,
    allCookies: cookies,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    },
    headers: {
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      host: request.headers.get('host'),
    }
  };
  
  return Response.json(debugInfo, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}
