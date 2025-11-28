export const runtime = "edge";

import { getRequestContext } from '@cloudflare/next-on-pages';

// Temporary debug endpoint - DELETE AFTER DEBUGGING
export async function GET(request: Request) {
  // Only allow in non-production or with a secret query param
  const url = new URL(request.url);
  const isProduction = url.hostname === 'creatortoolhub.com';

  if (isProduction) {
    return new Response('Not available in production', { status: 403 });
  }

  // Try to get Cloudflare context
  let cfEnv: Record<string, unknown> = {};
  let cfEnvKeys: string[] = [];
  try {
    const ctx = getRequestContext();
    cfEnv = ctx.env as Record<string, unknown>;
    cfEnvKeys = Object.keys(cfEnv);
  } catch (e) {
    cfEnvKeys = [`Error: ${e}`];
  }

  const envCheck = {
    hostname: url.hostname,
    // Check process.env
    processEnv: {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      googleClientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...',
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      nextAuthUrl: process.env.NEXTAUTH_URL || 'NOT SET',
      nodeEnv: process.env.NODE_ENV || 'NOT SET',
    },
    // Check Cloudflare context.env
    cloudflareEnv: {
      keys: cfEnvKeys,
      hasGoogleClientId: !!cfEnv.GOOGLE_CLIENT_ID,
      googleClientIdPrefix: typeof cfEnv.GOOGLE_CLIENT_ID === 'string'
        ? cfEnv.GOOGLE_CLIENT_ID.substring(0, 10) + '...'
        : 'not a string',
      hasGoogleClientSecret: !!cfEnv.GOOGLE_CLIENT_SECRET,
    },
  };

  return new Response(JSON.stringify(envCheck, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

