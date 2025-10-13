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
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for');
  if (ip) headers.set('x-forwarded-for', ip);
  const host = req.headers.get('host');
  if (host) headers.set('x-forwarded-host', host);
  return headers;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const target = `${WORKER_BASE}/api/user/generations/${encodeURIComponent(id)}`;
    const res = await fetch(target, { method: 'GET', headers: forwardHeaders(_req) });
    const body = await res.arrayBuffer();
    const out = new Response(body, { status: res.status, statusText: res.statusText });
    res.headers.forEach((v, k) => {
      if (!['content-encoding', 'transfer-encoding'].includes(k.toLowerCase())) out.headers.set(k, v);
    });
    if (!out.headers.get('content-type')) out.headers.set('content-type', 'application/json');
    return out;
  } catch (err: any) {
    return NextResponse.json({ error: 'Upstream error', message: String(err?.message || err) }, { status: 502 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const target = `${WORKER_BASE}/api/user/generations/${encodeURIComponent(id)}`;
    const res = await fetch(target, { method: 'DELETE', headers: forwardHeaders(_req) });
    const body = await res.arrayBuffer();
    const out = new Response(body, { status: res.status, statusText: res.statusText });
    res.headers.forEach((v, k) => {
      if (!['content-encoding', 'transfer-encoding'].includes(k.toLowerCase())) out.headers.set(k, v);
    });
    if (!out.headers.get('content-type')) out.headers.set('content-type', 'application/json');
    return out;
  } catch (err: any) {
    return NextResponse.json({ error: 'Upstream error', message: String(err?.message || err) }, { status: 502 });
  }
}

