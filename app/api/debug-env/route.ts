export const runtime = "edge";

// Temporary debug endpoint - DELETE AFTER DEBUGGING
export async function GET(request: Request) {
  // Only allow in non-production or with a secret query param
  const url = new URL(request.url);
  const isProduction = url.hostname === 'creatortoolhub.com';
  
  if (isProduction) {
    return new Response('Not available in production', { status: 403 });
  }

  const envCheck = {
    hostname: url.hostname,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    googleClientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...',
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    nextAuthUrl: process.env.NEXTAUTH_URL || 'NOT SET',
    nodeEnv: process.env.NODE_ENV || 'NOT SET',
    // Check globalThis as well
    globalThisKeys: Object.keys(globalThis).filter(k => 
      k.includes('GOOGLE') || k.includes('NEXT') || k.includes('AUTH')
    ),
  };

  return new Response(JSON.stringify(envCheck, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

