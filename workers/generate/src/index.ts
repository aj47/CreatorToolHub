import { Autumn } from "autumn-js";
import { DatabaseService } from "./storage/database";
import { R2StorageService } from "./storage/r2";
import { UserAPI } from "./api/user";
import { deriveUserId } from "./storage/utils";
import {
  createDefaultMiddlewareStack,
  createRouteHandler,
  jsonResponse,
  errorResponse,
  AuthenticatedRequest
} from "./middleware";

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
    try {
      // Create middleware stack
      const middlewareStack = createDefaultMiddlewareStack();

      // Add user API routes
      middlewareStack.route('/api/user', createRouteHandler(async (req, env) => {
        return await handleUserAPI(req, env);
      }));

      // Add generation route
      middlewareStack.route('/api/generate', createRouteHandler(async (req, env) => {
        return await handleGeneration(req, env);
      }), ['POST']);

      // Add health check route
      middlewareStack.route('/api/health', createRouteHandler(async (req, env) => {
        return jsonResponse({ status: 'healthy', timestamp: Date.now() });
      }), ['GET']);

      // Add file proxy route for local development
      // Include OPTIONS for CORS preflight requests
      middlewareStack.route(/^\/api\/files\//, createRouteHandler(async (req, env) => {
        return await handleFileProxy(req, env);
      }), ['GET', 'OPTIONS']);

      // Process request through middleware stack
      return await middlewareStack.handle(request as AuthenticatedRequest, env);
    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse(
        'Internal server error',
        500,
        'WORKER_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
};

// Handler functions
async function handleFileProxy(request: AuthenticatedRequest, env: Env): Promise<Response> {
  try {
    // Extract the file key from the URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const encodedKey = pathParts[pathParts.length - 1];
    const key = decodeURIComponent(encodedKey);

    if (!env.R2) {
      return errorResponse('Storage not configured', 500, 'R2_NOT_CONFIGURED');
    }

    // Fetch the file from R2
    const object = await env.R2.get(key);
    if (!object) {
      return errorResponse('File not found', 404, 'FILE_NOT_FOUND');
    }

    // Get the file content
    const arrayBuffer = await object.arrayBuffer();
    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';

    // Return the file with appropriate headers
    // CORS headers are handled by corsMiddleware, not here
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      }
    });
  } catch (error) {
    console.error('File proxy error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch file',
      500,
      'FILE_PROXY_ERROR'
    );
  }
}

async function handleUserAPI(request: AuthenticatedRequest, env: Env): Promise<Response> {
  // Validate environment bindings
  if (!env.DB) {
    console.error('Missing DB binding');
    return errorResponse('Database not configured', 500, 'DB_NOT_CONFIGURED');
  }

  if (!env.R2) {
    console.error('Missing R2 binding');
    return errorResponse('Storage not configured', 500, 'R2_NOT_CONFIGURED');
  }

  try {
    const db = new DatabaseService(env.DB);
    const r2 = new R2StorageService(env.R2, env);
    const userAPI = new UserAPI(db, r2, env);
    return await userAPI.handleRequest(request);
  } catch (error) {
    console.error('User API error:', error);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
      'USER_API_ERROR',
      error instanceof Error ? error.stack : undefined
    );
  }
}

async function handleGeneration(request: AuthenticatedRequest, env: Env): Promise<Response> {
  if (request.method === "GET") {
    return jsonResponse({ status: "ok" }, 200, { "Cache-Control": "no-store" });
  }
  if (request.method !== "POST") {
    return errorResponse("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
  }

  // Parse and validate early (before streaming)
  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400, "INVALID_JSON");
  }

  const {
    prompt,
    frames = [],
    framesMime,
    variants,
    templateId,
    source,
    parentGenerationId
  } = body || {};
  if (!prompt || !Array.isArray(frames) || frames.length === 0) {
    return errorResponse("Missing prompt or frames", 400, "MISSING_DATA");
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return errorResponse("Missing GEMINI_API_KEY", 500, "MISSING_API_KEY");
  }
  const model = env.MODEL_ID || DEFAULT_MODEL;
  const imageMime = (typeof framesMime === "string" && framesMime.startsWith("image/")) ? framesMime : "image/png";
  const count = Math.max(1, Math.min(Number(variants) || 1, 8));

  if (!env.DB) {
    console.error('Missing DB binding');
    return errorResponse('Database not configured', 500, 'DB_NOT_CONFIGURED');
  }
  if (!env.R2) {
    console.error('Missing R2 binding');
    return errorResponse('Storage not configured', 500, 'R2_NOT_CONFIGURED');
  }

  // Auth + credit gate before opening stream
  const user = request.user;
  if (!user) {
    return errorResponse("Unauthorized", 401, "UNAUTHORIZED");
  }

  const userId = deriveUserId(user.email);
  const db = new DatabaseService(env.DB);
  const r2 = new R2StorageService(env.R2, env);

  // Ensure user exists in database before proceeding
  try {
    await db.createOrUpdateUser(user.email, user.name, user.picture);
  } catch (error) {
    console.error('Failed to create/update user:', error);
    return errorResponse(
      "Failed to initialize user account",
      500,
      "USER_CREATION_FAILED",
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  const FEATURE_ID = env.FEATURE_ID || "credits";
  if (!env.AUTUMN_SECRET_KEY) {
    return errorResponse("Missing AUTUMN_SECRET_KEY", 500, "MISSING_AUTUMN_KEY");
  }
  const autumn = new Autumn({ secretKey: env.AUTUMN_SECRET_KEY });
  const customer_id = deriveCustomerId(user.email);
  const checkRes = await autumn.check({ customer_id, feature_id: FEATURE_ID, required_balance: count });
  if (!checkRes?.data?.allowed) {
    return errorResponse(
      "Insufficient credits",
      402,
      "INSUFFICIENT_CREDITS",
      { feature_id: FEATURE_ID, required: count }
    );
  }

  const framesArray = frames as string[];
  const framesForModel = framesArray.slice(0, 3);
  const reqParts: any[] = [];
  for (const b64 of framesForModel) {
    if (typeof b64 === "string" && b64.length > 0) {
      reqParts.push({ inlineData: { mimeType: imageMime, data: b64 } });
    }
  }
  reqParts.push({ text: prompt });

  // Validate templateId if provided
  if (templateId) {
    const template = await db.getTemplate(templateId, userId);
    if (!template) {
      return errorResponse(
        "Template not found or access denied",
        400,
        "INVALID_TEMPLATE_ID",
        { templateId }
      );
    }
  }

  // Validate parentGenerationId if provided
  if (parentGenerationId) {
    const parentGeneration = await db.getGeneration(parentGenerationId, userId);
    if (!parentGeneration) {
      return errorResponse(
        "Parent generation not found or access denied",
        400,
        "INVALID_PARENT_GENERATION_ID",
        { parentGenerationId }
      );
    }
  }

  // Create generation record with retry logic
  let generation;
  try {
    generation = await db.createGeneration(userId, {
      templateId,
      prompt,
      variantsRequested: count,
      status: "running",
      source: typeof source === "string" ? source : "worker",
      parentGenerationId
    });
  } catch (error) {
    console.error('Failed to create generation:', error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to create generation",
      500,
      "GENERATION_CREATION_FAILED",
      { userId, templateId, parentGenerationId }
    );
  }

  if (framesArray.length > 0) {
    try {
      await db.addGenerationInputs(
        generation.id,
        framesArray.map((frame, index) => ({
          input_type: "frame",
          metadata: {
            index,
            mime_type: imageMime,
            encoding: "base64",
            size_hint: frame.length,
            used_in_generation: index < framesForModel.length
          }
        }))
      );
    } catch (inputError) {
      console.warn('Failed to record generation inputs', inputError);
    }
  }

  // Stream NDJSON with periodic heartbeats and incremental results
  const te = new TextEncoder();
  let doneVariants = 0;
  let outputIndex = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (obj: any) => controller.enqueue(te.encode(JSON.stringify(obj) + "\n"));
      const heartbeat = () => controller.enqueue(te.encode(":\n"));
      const hbId = setInterval(heartbeat, 10000);

      const finalize = async (status: "complete" | "failed", errorMessage?: string) => {
        try {
          await db.updateGeneration(generation.id, userId, {
            status,
            error_message: status === "failed" ? errorMessage ?? null : null
          });
        } catch (updateError) {
          console.error('Failed to update generation status', updateError);
        }
      };

      try {
        write({ type: "start", total: count, generationId: generation.id });

        const CONCURRENCY = 3;
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
              const outputsToPersist: Array<{
                variant_index: number;
                r2_key: string;
                mime_type: string;
                size_bytes: number;
                hash?: string;
              }> = [];
              const pendingMessages: Array<{
                dataUrl: string;
                variantIndex: number;
                storageKey: string;
                mimeType: string;
              }> = [];

              for (const dataUrl of imgs) {
                const variantIndex = outputIndex++;
                try {
                  const storageResult = await r2.saveGenerationOutputFromDataUrl(
                    userId,
                    generation.id,
                    variantIndex,
                    dataUrl
                  );
                  outputsToPersist.push({
                    variant_index: variantIndex,
                    r2_key: storageResult.key,
                    mime_type: storageResult.contentType,
                    size_bytes: storageResult.sizeBytes,
                    hash: storageResult.hash
                  });
                  pendingMessages.push({
                    dataUrl,
                    variantIndex,
                    storageKey: storageResult.key,
                    mimeType: storageResult.contentType
                  });
                } catch (storageError) {
                  console.error('Failed to persist generation output', storageError);
                  write({
                    type: "variant_error",
                    generationId: generation.id,
                    variantIndex,
                    error: storageError instanceof Error ? storageError.message : String(storageError)
                  });
                }
              }

              const persistedOutputs =
                outputsToPersist.length > 0
                  ? await db.addGenerationOutputs(generation.id, outputsToPersist)
                  : [];

              pendingMessages.forEach((pending, index) => {
                const persisted = persistedOutputs[index];
                write({
                  type: "image",
                  generationId: generation.id,
                  index: pending.variantIndex,
                  dataUrl: pending.dataUrl,
                  outputId: persisted?.id,
                  storageKey: pending.storageKey,
                  mimeType: pending.mimeType
                });
              });

              doneVariants += 1;
              write({ type: "progress", generationId: generation.id, done: doneVariants, total: count });
            } else {
              doneVariants += 1;
              write({
                type: "variant_error",
                generationId: generation.id,
                error: String(s.reason || "unknown")
              });
              write({ type: "progress", generationId: generation.id, done: doneVariants, total: count });
            }
          }
        }

        try {
          await autumn.track({ customer_id, feature_id: FEATURE_ID, value: count });
        } catch (trackError) {
          console.warn('Failed to track credit usage', trackError);
        }

        await finalize("complete");
        write({ type: "done", generationId: generation.id });
        clearInterval(hbId);
        controller.close();
      } catch (err: any) {
        clearInterval(hbId);
        const message = err?.message || "Unknown error";
        await finalize("failed", message);
        write({ type: "error", generationId: generation.id, message });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Disable some proxies buffering if present
      "X-Accel-Buffering": "no"
    }
  });
}

