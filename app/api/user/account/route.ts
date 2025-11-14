export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

const WORKER_BASE = process.env.WORKER_BASE_URL || 'https://creator-tool-hub.techfren.workers.dev';

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();
  const keep = ['cookie', 'authorization', 'content-type', 'accept'];
  for (const key of keep) {
    const v = req.headers.get(key);
    if (v) headers.set(key, v);
  }
  // Forward client IP hints when present
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for');
  if (ip) headers.set('x-forwarded-for', ip);
  const host = req.headers.get('host');
  if (host) headers.set('x-forwarded-host', host);
  return headers;
}

export async function DELETE(req: NextRequest) {
  try {
    const target = `${WORKER_BASE}/api/user/account`;

    const res = await fetch(target, {
      method: 'DELETE',
      headers: forwardHeaders(req),
    });

    // Stream through status and body
    const body = await res.arrayBuffer();
    const out = new Response(body, { status: res.status, statusText: res.statusText });
    res.headers.forEach((v, k) => {
      // Avoid setting hop-by-hop headers
      if (!['content-encoding', 'transfer-encoding'].includes(k.toLowerCase())) {
        out.headers.set(k, v);
      }
    });
    // Ensure JSON content-type for JSON responses
    if (!out.headers.get('content-type')) out.headers.set('content-type', 'application/json');
    return out;
  } catch (err: any) {
    return NextResponse.json({ error: 'Upstream error', message: String(err?.message || err) }, { status: 502 });
  }
}
