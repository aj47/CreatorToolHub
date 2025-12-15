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
  FAL_KEY?: string; // Fal AI API key for image editing
  MODEL_ID?: string; // optional override via Wrangler vars
  AUTUMN_SECRET_KEY?: string;
  FEATURE_ID?: string;
  DB: any; // Cloudflare D1 database binding
  R2: any;   // Cloudflare R2 bucket binding
  NODE_ENV?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  NEXTAUTH_URL?: string;
  NEXTAUTH_SECRET?: string;
}

// Fal AI model constants
const FAL_MODEL_FLUX = "fal-ai/flux-2-pro/edit" as const;
const FAL_MODEL_QWEN = "fal-ai/qwen-image-edit/image-to-image" as const;
type FalModel = typeof FAL_MODEL_FLUX | typeof FAL_MODEL_QWEN;

// Provider types
type Provider = 'gemini' | 'fal-flux' | 'fal-qwen' | 'all';
type SingleProvider = Exclude<Provider, 'all'>;

// Credit costs per provider
const PROVIDER_CREDITS: Record<SingleProvider, number> = {
  'gemini': 4,
  'fal-flux': 1,
  'fal-qwen': 1,
};

// Result type with provider label
interface LabeledImage {
  dataUrl: string;
  provider: SingleProvider;
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

const DEFAULT_MODEL = "gemini-3-pro-image-preview";
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
      generationConfig: {
        // Explicitly request only 1 image per API call
        // Note: This parameter may not be supported by all models
        candidateCount: 1,
        responseModalities: ["IMAGE"]
      },
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

/**
 * Upload a base64 image to Fal's storage and return the URL.
 * Fal's queue API requires HTTP URLs, not data URIs.
 *
 * Uses Fal's two-step upload process:
 * 1. Initiate upload to get upload_url and file_url
 * 2. PUT the file content to upload_url
 * 3. Return file_url for use in API calls
 */
async function uploadToFalStorage(
  apiKey: string,
  base64Image: string,
  contentType: string = 'image/png'
): Promise<string> {
  // Derive file extension from content type
  const ext = contentType.split('/')[1] || 'png';
  const fileName = `image-${Date.now()}.${ext}`;

  // Step 1: Initiate the upload
  const initiateResponse = await fetch(
    'https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3',
    {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content_type: contentType,
        file_name: fileName,
      }),
    }
  );

  if (!initiateResponse.ok) {
    const text = await initiateResponse.text();
    console.error(`Fal storage initiate error: ${initiateResponse.status}`, text.substring(0, 500));
    throw new Error(`Fal storage initiate error ${initiateResponse.status}: ${text}`);
  }

  const { upload_url: uploadUrl, file_url: fileUrl } = await initiateResponse.json() as {
    upload_url: string;
    file_url: string;
  };

  // Validate that we received valid URLs from the initiate response
  if (!uploadUrl || typeof uploadUrl !== 'string') {
    throw new Error('Fal storage initiate response missing valid upload_url');
  }
  if (!fileUrl || typeof fileUrl !== 'string') {
    throw new Error('Fal storage initiate response missing valid file_url');
  }

  // Step 2: Convert base64 to binary and upload to the presigned URL
  let binaryString: string;
  try {
    binaryString = atob(base64Image);
  } catch (e) {
    throw new Error(
      `Invalid base64 image data: ${e instanceof Error ? e.message : 'atob decoding failed'}. ` +
      `Ensure the image is a valid base64 string without data URI prefix.`
    );
  }
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: bytes,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    console.error(`Fal storage upload error: ${uploadResponse.status}`, text.substring(0, 500));
    throw new Error(`Fal storage upload error ${uploadResponse.status}: ${text}`);
  }

  return fileUrl;
}

async function callFalGenerate(
  apiKey: string,
  prompt: string,
  frames: string[],
  model: FalModel = FAL_MODEL_FLUX,
  contentType: string = 'image/png'
): Promise<string[]> {
  // Validate frames array
  if (!frames || frames.length === 0) {
    throw new Error('Fal generation requires at least one frame');
  }

  // Use the first frame as the reference image
  const referenceFrame = frames[0];

  // Validate that referenceFrame is a non-empty string
  if (typeof referenceFrame !== 'string' || referenceFrame.length === 0) {
    throw new Error('Reference frame must be a non-empty base64 string');
  }

  // Upload the image to Fal's storage to get an HTTP URL
  // Fal's queue API requires HTTP URLs, not data URIs
  const imageUrl = await uploadToFalStorage(apiKey, referenceFrame, contentType);

  // Build input based on model type
  // Flux uses image_urls (array), Qwen uses image_url (singular)
  const isQwen = model === FAL_MODEL_QWEN;
  const requestBody = isQwen
    ? {
        prompt,
        image_url: imageUrl, // Qwen uses singular image_url
        output_format: "png",
      }
    : {
        prompt,
        image_urls: [imageUrl], // Flux uses plural image_urls
        image_size: "landscape_16_9",
        output_format: "png",
        sync_mode: false
      };

  // Submit request to Fal AI queue
  const submitResp = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!submitResp.ok) {
    const text = await submitResp.text();
    console.error(`Fal AI submit error: ${submitResp.status}`, text.substring(0, 500));
    throw new Error(`Fal AI error ${submitResp.status}: ${text}`);
  }

  const submitResult = await submitResp.json() as { request_id: string; status_url?: string; response_url?: string };
  const requestId = submitResult.request_id;

  if (!requestId) {
    throw new Error("Fal AI did not return a request_id");
  }

  // For models with subpaths (like fal-ai/qwen-image-edit/image-to-image),
  // the subpath should be used when making the request, but NOT when getting status/results.
  // Extract the base model ID (first two path segments) for status/result URLs.
  const modelParts = model.split('/');
  const baseModelId = modelParts.length > 2
    ? `${modelParts[0]}/${modelParts[1]}`
    : model;

  // Use the URLs from the response if available, otherwise construct them
  const statusUrl = submitResult.status_url || `https://queue.fal.run/${baseModelId}/requests/${requestId}/status`;
  const resultUrl = submitResult.response_url || `https://queue.fal.run/${baseModelId}/requests/${requestId}`;
  const maxAttempts = 60; // 60 * 2s = 2 minutes max wait
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    attempts++;

    const statusResp = await fetch(statusUrl, {
      headers: { "Authorization": `Key ${apiKey}` }
    });

    if (!statusResp.ok) {
      console.warn(`Fal AI status check failed: ${statusResp.status}`);
      continue;
    }

    const status = await statusResp.json() as { status: string };

    if (status.status === "COMPLETED") {
      // Fetch the result
      const resultResp = await fetch(resultUrl, {
        headers: { "Authorization": `Key ${apiKey}` }
      });

      if (!resultResp.ok) {
        const text = await resultResp.text();
        throw new Error(`Failed to fetch Fal AI result: ${text}`);
      }

      const result = await resultResp.json() as { images?: Array<{ url: string }> };

      if (!result.images || result.images.length === 0) {
        throw new Error("No images in Fal AI result");
      }

      // Fetch images and convert to base64
      const images: string[] = [];
      for (const img of result.images) {
        const imageResponse = await fetch(img.url);
        const imageBuffer = await imageResponse.arrayBuffer();
        // Convert ArrayBuffer to base64 using Web APIs
        const uint8Array = new Uint8Array(imageBuffer);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binaryString);
        images.push(base64);
      }

      return images;
    } else if (status.status === "FAILED") {
      throw new Error("Fal AI generation failed");
    }
    // Continue polling for IN_QUEUE, IN_PROGRESS
  }

  throw new Error("Fal AI generation timed out");
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
      }), ['POST', 'OPTIONS']);

      // Add health check route
      middlewareStack.route('/api/health', createRouteHandler(async (req, env) => {
        return jsonResponse({ status: 'healthy', timestamp: Date.now() });
      }), ['GET']);

      // Add file proxy route
      // Include OPTIONS for CORS preflight requests
      // Use /r2/ path which is handled by the worker route
      middlewareStack.route(/^\/r2\//, createRouteHandler(async (req, env) => {
        return await handleFileProxy(req, env);
      }), ['GET', 'OPTIONS']);

      // Add /api/r2/ route for file proxy (alternative path)
      middlewareStack.route(/^\/api\/r2\//, createRouteHandler(async (req, env) => {
        return await handleFileProxy(req, env);
      }), ['GET', 'OPTIONS']);

      // Add auth routes
      middlewareStack.route('/api/auth/session', createRouteHandler(async (req, env) => {
        if (req.method !== 'GET') {
          return errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
        }
        const user = getUser(req);
        return jsonResponse({
          authenticated: !!user,
          user: user || null
        });
      }), ['GET', 'HEAD']);

      middlewareStack.route(/^\/api\/auth\/signin/, createRouteHandler(async (req, env) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          return errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
        }
        const googleClientId = env.GOOGLE_CLIENT_ID || '';
        const nextAuthUrl = env.NEXTAUTH_URL || 'https://creatortoolhub.com';
        const redirectUri = `${nextAuthUrl}/api/auth/callback`;
        const scope = 'openid email profile';
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=signin`;
        return new Response(null, {
          status: 302,
          headers: { 'Location': googleAuthUrl }
        });
      }), ['GET', 'HEAD']);

      // OAuth callback handler
      middlewareStack.route('/api/auth/callback', createRouteHandler(async (req, env) => {
        if (req.method !== 'GET') {
          return errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
        }

        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        const googleClientId = env.GOOGLE_CLIENT_ID || '';
        const googleClientSecret = env.GOOGLE_CLIENT_SECRET || '';
        const nextAuthUrl = env.NEXTAUTH_URL || 'https://creatortoolhub.com';

        // Handle OAuth errors
        if (error) {
          return new Response(null, {
            status: 302,
            headers: { 'Location': `${nextAuthUrl}/?error=${error}` }
          });
        }

        // Check for authorization code
        if (!code) {
          return new Response(null, {
            status: 302,
            headers: { 'Location': `${nextAuthUrl}/?error=no_code` }
          });
        }

        // Check if OAuth is configured
        if (!googleClientId || !googleClientSecret) {
          return new Response(null, {
            status: 302,
            headers: { 'Location': `${nextAuthUrl}/?error=oauth_config` }
          });
        }

        try {
          // Exchange code for token
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: googleClientId,
              client_secret: googleClientSecret,
              code,
              grant_type: 'authorization_code',
              redirect_uri: `${nextAuthUrl}/api/auth/callback`,
            }).toString(),
          });

          const tokens = await tokenResponse.json();

          if (!tokens.access_token) {
            return new Response(null, {
              status: 302,
              headers: { 'Location': `${nextAuthUrl}/?error=no_token` }
            });
          }

          // Get user info
          const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          const user = await userResponse.json();

          // Validate user data
          if (!user.email) {
            return new Response(null, {
              status: 302,
              headers: { 'Location': `${nextAuthUrl}/?error=no_email` }
            });
          }

          // Create auth token
          const payload = {
            email: user.email,
            name: user.name || '',
            picture: user.picture || '',
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
          };
          const token = btoa(JSON.stringify(payload));
          const authCookie = `auth-token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`;

          return new Response(null, {
            status: 302,
            headers: {
              'Location': nextAuthUrl,
              'Set-Cookie': authCookie
            }
          });
        } catch (error) {
          console.error('OAuth callback error:', error);
          return new Response(null, {
            status: 302,
            headers: { 'Location': `${nextAuthUrl}/?error=oauth_error` }
          });
        }
      }), ['GET']);

      middlewareStack.route(/^\/api\/auth\/signout/, createRouteHandler(async (req, env) => {
        const signOutCookie = 'auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; HttpOnly; Secure; SameSite=Lax';

        if (req.method === 'GET') {
          return new Response(null, {
            status: 302,
            headers: {
              'Location': '/',
              'Set-Cookie': signOutCookie
            }
          });
        }

        if (req.method === 'POST') {
          return jsonResponse({ success: true }, 200, {
            'Set-Cookie': signOutCookie
          });
        }

        return errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
      }), ['GET', 'POST', 'HEAD']);


      // Bypass: forward /api/autumn/* to Pages/Next.js origin so Next API handles it
      // This prevents the Worker from intercepting these routes and returning 404s
      middlewareStack.route(/^\/api\/autumn\//, createRouteHandler(async (req, env) => {
        // Forward request as-is to origin (Next.js /api route on Cloudflare Pages)
        const forwarded = new Request(req);
        const resp = await fetch(forwarded);
        return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
      }), ['GET', 'POST', 'HEAD', 'OPTIONS']);


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
    // Remove the /r2/ or /api/r2/ prefix to get the encoded key
    let encodedKey = url.pathname.replace(/^\/api\/r2\//, '');
    if (encodedKey === url.pathname) {
      // If /api/r2/ didn't match, try /r2/
      encodedKey = url.pathname.replace(/^\/r2\//, '');
    }
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
    templateName,
    source,
    parentGenerationId,
    providers,
    model: requestedModel,
    refinementPrompt
  } = body || {};
  if (!prompt || !Array.isArray(frames) || frames.length === 0) {
    return errorResponse("Missing prompt or frames", 400, "MISSING_DATA");
  }

  // Normalize providers - support both array and legacy single provider format
  let providersToUse: SingleProvider[];
  if (Array.isArray(providers) && providers.length > 0) {
    providersToUse = providers.filter((p: string) => ['gemini', 'fal-flux', 'fal-qwen'].includes(p)) as SingleProvider[];
  } else if (typeof providers === 'string' && providers === 'all') {
    providersToUse = ['gemini', 'fal-flux', 'fal-qwen'];
  } else if (typeof providers === 'string') {
    providersToUse = [providers as SingleProvider];
  } else {
    providersToUse = ['gemini']; // default
  }

  if (providersToUse.length === 0) {
    return errorResponse(
      "At least one valid provider must be selected",
      400,
      "NO_PROVIDERS"
    );
  }

  // Check for required API keys based on providers
  const geminiKey = env.GEMINI_API_KEY;
  const falKey = env.FAL_KEY;

  const needsGemini = providersToUse.includes('gemini');
  const needsFal = providersToUse.includes('fal-flux') || providersToUse.includes('fal-qwen');

  if (needsGemini && !geminiKey) {
    return errorResponse("Missing GEMINI_API_KEY", 500, "MISSING_API_KEY");
  }
  if (needsFal && !falKey) {
    return errorResponse("Missing FAL_KEY", 500, "MISSING_FAL_KEY");
  }

  const geminiModel = env.MODEL_ID || DEFAULT_MODEL;
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

  // Calculate total credits needed based on providers
  // Each provider has its own cost per image, multiplied by count
  const totalCreditsNeeded = providersToUse.reduce((sum, p) => sum + PROVIDER_CREDITS[p] * count, 0);

  // Skip credit check in development mode
  const isDevelopment = env.NODE_ENV === 'development';
  let autumn: Autumn | null = null;
  let customer_id: string | null = null;

  if (!isDevelopment) {
    if (!env.AUTUMN_SECRET_KEY) {
      return errorResponse("Missing AUTUMN_SECRET_KEY", 500, "MISSING_AUTUMN_KEY");
    }
    autumn = new Autumn({ secretKey: env.AUTUMN_SECRET_KEY });
    customer_id = deriveCustomerId(user.email);

    // Check for required credits based on provider costs
    const checkRes = await autumn.check({ customer_id, feature_id: FEATURE_ID, required_balance: totalCreditsNeeded });
    if (!checkRes?.data?.allowed) {
      return errorResponse(
        "Insufficient credits",
        402,
        "INSUFFICIENT_CREDITS",
        { feature_id: FEATURE_ID, required: totalCreditsNeeded }
      );
    }
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

  // Validate templateId if provided and get template name
  let resolvedTemplateName = templateName;
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
    // Use the template's title if no templateName was provided
    if (!resolvedTemplateName) {
      resolvedTemplateName = template.title;
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

  // Determine the model string (join providers for multi-provider generations)
  const modelString = providersToUse.join(',');

  // Create generation record with retry logic
  let generation;
  try {
    generation = await db.createGeneration(userId, {
      templateId,
      templateName: resolvedTemplateName,
      prompt,
      variantsRequested: count,
      status: "running",
      source: typeof source === "string" ? source : "worker",
      parentGenerationId,
      model: modelString,
      refinementPrompt
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
        // Calculate total expected images across all providers
        const totalExpectedImages = providersToUse.length * count;
        write({ type: "start", total: totalExpectedImages, generationId: generation.id });

        // Helper function to generate with a specific provider
        async function generateWithProvider(prov: SingleProvider): Promise<LabeledImage[]> {
          const labeledImages: LabeledImage[] = [];

          if (prov === 'gemini') {
            const json = await callGeminiGenerate(geminiKey!, geminiModel, reqParts);
            const cand = json?.candidates?.[0];
            const parts = cand?.content?.parts ?? [];
            console.log(`Gemini API returned ${parts.length} parts in response`);

            for (const p of parts) {
              if (p?.inlineData?.data && p?.inlineData?.mimeType) {
                const { data, mimeType } = p.inlineData;
                labeledImages.push({
                  dataUrl: `data:${mimeType};base64,${data}`,
                  provider: 'gemini'
                });
              }
            }
          } else {
            // Fal providers
            const falModel = prov === 'fal-flux' ? FAL_MODEL_FLUX : FAL_MODEL_QWEN;
            // Pass imageMime for upload content type, but Fal outputs PNG (output_format: "png")
            const images = await callFalGenerate(falKey!, prompt, framesArray, falModel, imageMime);
            for (const base64 of images) {
              labeledImages.push({
                // Fal always outputs PNG regardless of input format (output_format: "png")
                dataUrl: `data:image/png;base64,${base64}`,
                provider: prov
              });
            }
          }

          return labeledImages;
        }

        // Generate for each provider in parallel batches
        const CONCURRENCY = 3;

        for (let i = 0; i < count; i += CONCURRENCY) {
          const batchSize = Math.min(CONCURRENCY, count - i);

          // For each variant in this batch, generate with all providers
          const batchPromises: Promise<LabeledImage[]>[] = [];

          for (let v = 0; v < batchSize; v++) {
            // Generate with each provider for this variant
            for (const prov of providersToUse) {
              batchPromises.push(generateWithProvider(prov));
            }
          }

          const settled = await Promise.allSettled(batchPromises);

          for (const s of settled) {
            if (s.status === "fulfilled") {
              const labeledImages = s.value;
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
                provider: SingleProvider;
              }> = [];

              for (const labeled of labeledImages) {
                const variantIndex = outputIndex++;
                try {
                  const storageResult = await r2.saveGenerationOutputFromDataUrl(
                    userId,
                    generation.id,
                    variantIndex,
                    labeled.dataUrl
                  );
                  outputsToPersist.push({
                    variant_index: variantIndex,
                    r2_key: storageResult.key,
                    mime_type: storageResult.contentType,
                    size_bytes: storageResult.sizeBytes,
                    hash: storageResult.hash
                  });
                  pendingMessages.push({
                    dataUrl: labeled.dataUrl,
                    variantIndex,
                    storageKey: storageResult.key,
                    mimeType: storageResult.contentType,
                    provider: labeled.provider
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
                  mimeType: pending.mimeType,
                  provider: pending.provider
                });
              });

              doneVariants += 1;
              write({ type: "progress", generationId: generation.id, done: doneVariants, total: totalExpectedImages });
            } else {
              doneVariants += 1;
              write({
                type: "variant_error",
                generationId: generation.id,
                error: String(s.reason || "unknown")
              });
              write({ type: "progress", generationId: generation.id, done: doneVariants, total: totalExpectedImages });
            }
          }
        }

        // Track credit usage (skip in development)
        // Charge based on provider-specific costs
        const actualImagesGenerated = outputIndex;
        if (!isDevelopment && autumn && customer_id) {
          try {
            await autumn.track({ customer_id, feature_id: FEATURE_ID, value: totalCreditsNeeded });
            console.log(`Tracked ${totalCreditsNeeded} credits for generation ${generation.id} (providers: ${providersToUse.join(', ')}, variants: ${count}, generated: ${actualImagesGenerated} images)`);
          } catch (trackError) {
            console.warn('Failed to track credit usage', trackError);
          }
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

