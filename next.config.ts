import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_API_URL;
    let workerOrigin = '';
    try { workerOrigin = workerUrl ? new URL(workerUrl).origin : ''; } catch {}

    const scriptSrc = [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
    ];
    // Add Clarity only if configured
    if (process.env.NEXT_PUBLIC_CLARITY_ID) {
      scriptSrc.push('https://www.clarity.ms');
    }

    const connectSrc = [
      "'self'",
      'https://oauth2.googleapis.com',
      'https://www.googleapis.com',
      'https://generativelanguage.googleapis.com',
    ];
    // Add Clarity only if configured
    if (process.env.NEXT_PUBLIC_CLARITY_ID) {
      connectSrc.push('https://www.clarity.ms');
    }
    if (workerOrigin) connectSrc.push(workerOrigin);
    if (process.env.NODE_ENV !== 'production') {
      // When running wrangler dev locally
      connectSrc.push('http://localhost:8787');
    }

    const frameSrc = [
      "'self'",
      "https://www.youtube.com",
      "https://youtube.com",
      "https://www.youtube-nocookie.com",
    ];

    const imgSrc = ["'self'", 'data:', 'https:', 'blob:'];
    if (workerOrigin) {
      // Allow images from configured worker origin
      imgSrc.push(workerOrigin);
    }
    if (process.env.NODE_ENV !== 'production') {
      // Allow images from local worker in development
      imgSrc.push('http://localhost:8787');
    }

    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc.join(' ')}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src ${imgSrc.join(' ')}`,
      "media-src 'self' blob: data:",
      `connect-src ${connectSrc.join(' ')}`,
      `frame-src ${frameSrc.join(' ')}`,
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
