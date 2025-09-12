import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_API_URL;
    let workerOrigin = '';
    try { workerOrigin = workerUrl ? new URL(workerUrl).origin : ''; } catch {}

    const connectSrc = [
      "'self'",
      'https://oauth2.googleapis.com',
      'https://www.googleapis.com',
      'https://generativelanguage.googleapis.com',
    ];
    if (workerOrigin) connectSrc.push(workerOrigin);
    if (process.env.NODE_ENV !== 'production') {
      // When running wrangler dev locally
      connectSrc.push('http://localhost:8787');
    }

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "media-src 'self' blob: data:",
      `connect-src ${connectSrc.join(' ')}`,
      "frame-src 'none'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
