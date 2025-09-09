import { Autumn } from "autumn-js";

export interface Env {
  GEMINI_API_KEY: string;
  MODEL_ID?: string; // optional override via Wrangler vars
  AUTUMN_SECRET_KEY?: string;
  FEATURE_ID?: string;
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

    if (request.method !== "POST" || url.pathname !== "/api/generate") {
      return new Response("Not Found", { status: 404 });
    }

    try {
      const { prompt, frames = [], framesMime, variants, layoutImage } = await request.json();

      if (!prompt || !Array.isArray(frames) || frames.length === 0) {
        return Response.json({ error: "Missing prompt or frames" }, { status: 400 });
      }

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
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
      // layoutImage is not used currently; left for future extension

      const count = Math.max(1, Math.min(Number(variants) || 1, 8));
      // Autumn credit check/gate
      const user = getUser(request);
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const FEATURE_ID = env.FEATURE_ID || "credits";
      if (!env.AUTUMN_SECRET_KEY) {
        return Response.json({ error: "Missing AUTUMN_SECRET_KEY" }, { status: 500 });
      }
      const autumn = new Autumn({ secretKey: env.AUTUMN_SECRET_KEY });
      const customer_id = deriveCustomerId(user.email);
      const checkRes = await autumn.check({ customer_id, feature_id: FEATURE_ID, required_balance: count });
      if (!checkRes?.data?.allowed) {
        return Response.json(
          { error: "Insufficient credits", code: "insufficient_credits", feature_id: FEATURE_ID, required: count },
          { status: 402 }
        );
      }

      const CONCURRENCY = 3; // generous but bounded

      const imagesAll: string[] = [];
      for (let i = 0; i < count; i += CONCURRENCY) {
        const batchSize = Math.min(CONCURRENCY, count - i);
        const batch = Array.from({ length: batchSize }, async () => {
          const json = await callGeminiGenerate(apiKey, model, reqParts);
          console.log("Gemini response:", JSON.stringify(json, null, 2).substring(0, 2000));
          const cand = json?.candidates?.[0];
          const parts = cand?.content?.parts ?? [];
          const imgs: string[] = [];

          // Look for inlineData in parts (this is where Gemini puts generated images)
          for (const p of parts) {
            if (p?.inlineData?.data && p?.inlineData?.mimeType) {
              const { data, mimeType } = p.inlineData;
              // Convert to data URL format
              const dataUrl = `data:${mimeType};base64,${data}`;
              imgs.push(dataUrl);
            }
          }

          if (imgs.length === 0) {
            // Log helpful diagnostics
            const safety = cand?.safetyRatings || cand?.safetyRatingsV2;
            const finish = cand?.finishReason;
            const firstPart = Array.isArray(parts) && parts[0] ? Object.keys(parts[0]) : [];
            console.error("Gemini returned no images", {
              model,
              finish,
              partsCount: Array.isArray(parts) ? parts.length : 0,
              firstPart,
              safety,
              promptLen: (typeof prompt === 'string' ? prompt.length : 0),
              framesCount: Array.isArray(frames) ? frames.length : 0,
              imageMime,
            });
          }
          return imgs;
        });
        const settled = await Promise.allSettled(batch);
        for (const s of settled) {
          if (s.status === "fulfilled") imagesAll.push(...s.value);
        }
      }

      if (imagesAll.length === 0) {
        console.error("No images generated in final aggregation", {
          count,
          imageMime,
          framesLen: Array.isArray(frames) ? frames.length : 0,
          promptLen: typeof prompt === 'string' ? prompt.length : 0,
        });
        return Response.json({ error: "Failed to generate any images" }, { status: 500 });
      }

      await autumn.track({ customer_id, feature_id: FEATURE_ID, value: count });
      return Response.json({ images: imagesAll });
    } catch (err: any) {
      return Response.json({ error: err?.message || "Unknown error" }, { status: 500 });
    }
  },
};

