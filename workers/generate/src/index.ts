import { Autumn } from "autumn-js";
import { DatabaseService } from "./storage/database";
import { R2StorageService } from "./storage/r2";
import { UserAPI } from "./api/user";

export interface Env {
  GEMINI_API_KEY: string;
  MODEL_ID?: string; // optional override via Wrangler vars
  AUTUMN_SECRET_KEY?: string;
  FEATURE_ID?: string;
  DB: any; // Cloudflare D1 database binding
  R2: any;   // Cloudflare R2 bucket binding
  NODE_ENV?: string;
}


// CORS utilities
function parseAllowedOrigins(env: any): string[] {
  const list: string[] = [];
  const envList = (env && (env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN)) as string | undefined;
  if (envList) {
    for (const o of envList.split(/[ ,]/).map((s: string) => s.trim()).filter(Boolean)) {
      list.push(o);
    }
  }
  // Sensible defaults
  list.push('http://localhost:3000', 'http://127.0.0.1:3000');
  list.push('https://creatortoolhub.com', 'https://www.creatortoolhub.com');
  return Array.from(new Set(list));
}

function buildCorsHeaders(request: Request, env: any): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowed = parseAllowedOrigins(env);
  const allowOrigin = origin && allowed.includes(origin) ? origin : '';
  const headers: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cookie',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
  if (allowOrigin) headers['Access-Control-Allow-Origin'] = allowOrigin;
  return headers;
}

function withCors(resp: Response, request: Request, env: any): Response {
  const cors = buildCorsHeaders(request, env);
  const headers = new Headers(resp.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

const DEFAULT_MODEL = "gemini-2.5-flash-image-preview";
// Auth helpers (mirrored from app/lib/auth.ts)
function getAuthToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
    const [key, ...rest] = cookie.trim().split("=");
    acc[key] = rest.join("=");
    return acc;
  }, {} as Record<string, string>);
  return cookies["auth-token"] || null;
}

function verifyAuthToken(token: string): { email: string; name?: string; picture?: string } | null {
  try {
    const payload = JSON.parse(atob(token));
    if (payload?.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload?.email) {
      return { email: payload.email, name: payload.name || "", picture: payload.picture || "" };
    }
    return null;
  } catch {
    return null;
  }
}

function getUser(request: Request): { email: string; name?: string; picture?: string } | null {
  const token = getAuthToken(request);
  if (!token) return null;
  return verifyAuthToken(token);
}

function deriveCustomerId(email: string): string {
  const raw = email.toLowerCase();
  const cleaned = raw
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+/, "")
    .replace(/[-_]+$/, "");
  return ("u-" + cleaned).slice(0, 40);
}


async function callGeminiGenerate(apiKey: string, model: string, parts: any[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    console.error(`Gemini API error: ${resp.status} ${resp.statusText}`, text.substring(0, 1000));
    throw new Error(`Gemini error ${resp.status}: ${text}`);
  }
  return resp.json();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Preflight for CORS
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    // Handle user data API routes
    if (url.pathname.startsWith("/api/user")) {
      const db = new DatabaseService(env.DB);
      const r2 = new R2StorageService(env.R2);
      const userAPI = new UserAPI(db, r2, env);
      const resp = await userAPI.handleRequest(request);
      return withCors(resp, request, env);
    }

    // Handle generation route
    if (url.pathname !== "/api/generate") {
      return withCors(new Response("Not Found", { status: 404 }), request, env);
    }
    if (request.method === "GET") {
      return withCors(Response.json({ status: "ok" }, { status: 200, headers: { "Cache-Control": "no-store" } }), request, env);
    }
    if (request.method !== "POST") {
      return withCors(new Response("Method Not Allowed", { status: 405 }), request, env);
    }

    // Parse and validate early (before streaming)
    let body: any;
    try {
      body = await request.json();
    } catch {
      return withCors(Response.json({ error: "Invalid JSON" }, { status: 400 }), request, env);
    }
    const { prompt, frames = [], framesMime, variants } = body || {};
    if (!prompt || !Array.isArray(frames) || frames.length === 0) {
      return withCors(Response.json({ error: "Missing prompt or frames" }, { status: 400 }), request, env);
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return withCors(Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 }), request, env);
    }
    const model = env.MODEL_ID || DEFAULT_MODEL;
    const imageMime = (typeof framesMime === "string" && framesMime.startsWith("image/")) ? framesMime : "image/png";

    // Build request parts once: up to 3 frames + text prompt
    const reqParts: any[] = [];
    for (const b64 of (frames as string[]).slice(0, 3)) {
      if (typeof b64 === "string" && b64.length > 0) {
        reqParts.push({ inlineData: { mimeType: imageMime, data: b64 } });
      }
    }
    reqParts.push({ text: prompt });

    const count = Math.max(1, Math.min(Number(variants) || 1, 8));

    // Auth + credit gate before opening stream
    const user = getUser(request);
    if (!user) {
      return withCors(Response.json({ error: "Unauthorized" }, { status: 401 }), request, env);
    }
    const FEATURE_ID = env.FEATURE_ID || "credits";
    if (!env.AUTUMN_SECRET_KEY) {
      return withCors(Response.json({ error: "Missing AUTUMN_SECRET_KEY" }, { status: 500 }), request, env);
    }
    const autumn = new Autumn({ secretKey: env.AUTUMN_SECRET_KEY });
    const customer_id = deriveCustomerId(user.email);
    const checkRes = await autumn.check({ customer_id, feature_id: FEATURE_ID, required_balance: count });
    if (!checkRes?.data?.allowed) {
      return withCors(Response.json(
        { error: "Insufficient credits", code: "insufficient_credits", feature_id: FEATURE_ID, required: count },
        { status: 402 }
      ), request, env);
    }

    // Stream NDJSON with periodic heartbeats and incremental results
    const te = new TextEncoder();
    let doneVariants = 0;
    let idx = 0;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const write = (obj: any) => controller.enqueue(te.encode(JSON.stringify(obj) + "\n"));
        const heartbeat = () => controller.enqueue(te.encode(":\n")); // comment line keeps H3 alive
        const hbId = setInterval(heartbeat, 10000);
        try {
          write({ type: "start", total: count });

          const CONCURRENCY = 3; // generous but bounded
          for (let i = 0; i < count; i += CONCURRENCY) {
            const batchSize = Math.min(CONCURRENCY, count - i);
            const batch = Array.from({ length: batchSize }, async () => {
              const json = await callGeminiGenerate(apiKey, model, reqParts);
              const cand = json?.candidates?.[0];
              const parts = cand?.content?.parts ?? [];
              const imgs: string[] = [];
              for (const p of parts) {
                if (p?.inlineData?.data && p?.inlineData?.mimeType) {
                  const { data, mimeType } = p.inlineData;
                  imgs.push(`data:${mimeType};base64,${data}`);
                }
              }
              return imgs;
            });

            const settled = await Promise.allSettled(batch);
            for (const s of settled) {
              if (s.status === "fulfilled") {
                const imgs = s.value;
                // Emit each image as it becomes available
                for (const dataUrl of imgs) {
                  write({ type: "image", index: idx++, dataUrl });
                }
                doneVariants += 1;
                write({ type: "progress", done: doneVariants, total: count });
              } else {
                // Emit error for this variant but continue
                write({ type: "variant_error", error: String(s.reason || "unknown") });
                doneVariants += 1;
                write({ type: "progress", done: doneVariants, total: count });
              }
            }
          }

          // Track credits after success (best-effort)
          try { await autumn.track({ customer_id, feature_id: FEATURE_ID, value: count }); } catch {}

          write({ type: "done" });
          clearInterval(hbId);
          controller.close();
        } catch (err: any) {
          clearInterval(hbId);
          write({ type: "error", message: err?.message || "Unknown error" });
          controller.close();
        }
      }
    });

    return withCors(new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        // Disable some proxies buffering if present
        "X-Accel-Buffering": "no"
      }
    }), request, env);
  },
};

