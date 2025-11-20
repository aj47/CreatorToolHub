// Use edge runtime for Cloudflare Pages compatibility
export const runtime = "edge";

import { getUser, createAuthToken } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";
import { Autumn } from "autumn-js";

// Use Gemini 3 Pro Image Preview - Google's most advanced image generation model (November 2025)
const MODEL_ID = "gemini-3-pro-image-preview";

async function generateImagesWithGemini(
  apiKey: string,
  prompt: string,
  _frames: string[],
  imageMime: string = "image/png",
  _layoutImage?: string
): Promise<string[]> {
  const genAI = new GoogleGenAI({ apiKey });

  try {
    // Build request parts: inlineData frames first (up to 3), then the text prompt
    const reqParts: Array<{ inlineData?: { mimeType: string; data: string } } | { text: string }> = [];
    for (const b64 of (_frames ?? []).slice(0, 3)) {
      if (typeof b64 === "string" && b64.length > 0) {
        reqParts.push({ inlineData: { mimeType: imageMime || "image/png", data: b64 } });
      }
    }
    reqParts.push({ text: prompt });

    const result = await genAI.models.generateContent({
      model: MODEL_ID,
      contents: [{ parts: reqParts }],
      config: {
        // Explicitly request only 1 image per API call
        candidateCount: 1,
        responseModalities: ["IMAGE"]
      }
    });

    // Extract base64 image data from inlineData parts
    const images: string[] = [];
    const resParts: any[] = (result as any)?.candidates?.[0]?.content?.parts ?? [];

    // Log the number of parts returned for debugging
    console.log(`Gemini API returned ${resParts.length} parts in response`);

    for (const part of resParts) {
      const b64 = part?.inlineData?.data as string | undefined;
      if (typeof b64 === 'string' && b64.length > 0) {
        images.push(b64);
      }
    }

    console.log(`Extracted ${images.length} images from Gemini response`);
    return images;
  } catch (error) {
    console.error("Error generating images:", error);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    // Require authentication - bypass in development
    let user = getUser(req);
    if (!user && process.env.NODE_ENV === 'development') {
      // Use mock user in development
      user = {
        email: 'dev@example.com',
        name: 'Dev User',
        picture: '',
      };
    }
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, frames = [], layoutImage, variants, framesMime, source } = await req.json();

    // Proxy to worker API for database persistence (both development and production)
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_API_URL || 'https://creator-tool-hub.techfren.workers.dev';
    if (workerUrl) {
      try {
        // Create auth token for worker API using the shared auth helper (UTF-8 safe)
        const authToken = createAuthToken(
          {
            email: user.email,
            name: user.name || '',
            picture: user.picture || '',
          },
          1 // 1 hour expiry
        );

        const workerRes = await fetch(`${workerUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `auth-token=${authToken}`
          },
          body: JSON.stringify({
            prompt,
            frames,
            framesMime,
            variants,
            source: source || 'thumbnails'
          })
        });

        if (!workerRes.ok) {
          // For auth/credit issues, surface the worker's response directly
          if (workerRes.status === 401 || workerRes.status === 402) {
            const error = await workerRes.json().catch(() => ({ error: `Worker API error (status: ${workerRes.status}, url: ${workerUrl})` }));
            return Response.json(error, { status: workerRes.status });
          }

          // For other failures (5xx, misconfiguration, etc.), fall back to direct Gemini handler
          console.warn("/api/generate: worker API returned", workerRes.status, "- falling back to direct Gemini handler");
          // Fall through to the direct Gemini path below
        } else {
          // Stream NDJSON response from worker
          return new Response(workerRes.body, {
            status: workerRes.status,
            headers: {
              'Content-Type': workerRes.headers.get('Content-Type') || 'application/x-ndjson',
              'Cache-Control': 'no-store, no-transform',
              'X-Accel-Buffering': 'no'
            }
          });
        }
      } catch (err) {
        console.warn("/api/generate: worker API unreachable, falling back to direct Gemini handler", err);
        // Fall through to the direct Gemini path below
      }
    }



    if (!prompt || !Array.isArray(frames) || frames.length === 0) {
      return Response.json(
        { error: "Missing prompt or frames" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Missing GEMINI_API_KEY or GOOGLE_API_KEY" },
        { status: 500 }
      );
    }

    // Autumn credit check: gate by feature balance
    const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";
    const deriveCustomerId = (email: string) => {
      const raw = email.toLowerCase();
      const cleaned = raw
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-_]+/, "")
        .replace(/[-_]+$/, "");
      return ("u-" + cleaned).slice(0, 40);
    };
    const customer_id = deriveCustomerId(user.email);

    const secretKey = process.env.AUTUMN_SECRET_KEY;
    const autumnEnabled = !!secretKey && process.env.NODE_ENV === 'production';

    // Each request consumes credits equal to the variant count
    // We've configured Gemini to return exactly 1 image per API call
    const count = Math.max(1, Math.min(Number(variants) || 1, 8));

    let allowed = true;
    let autumn: Autumn | null = null;
    if (autumnEnabled) {
      autumn = new Autumn({ secretKey: secretKey as string });
      try {
        const checkRes = await autumn.check({ customer_id, feature_id: FEATURE_ID, required_balance: count });
        allowed = !!checkRes?.data?.allowed;
      } catch (e) {
        if (process.env.NODE_ENV === "production") {
          return Response.json(
            { error: "Billing service unavailable. Please try again.", code: "billing_unavailable" },
            { status: 503 }
          );
        } else {
          console.warn("Autumn check failed in development; bypassing credit gate:", e);
        }
      }
      if (!allowed) {
        return Response.json(
          { error: "Insufficient credits", code: "insufficient_credits", feature_id: FEATURE_ID, required: count },
          { status: 402 }
        );
      }
    }

    // Run multiple variant calls with limited concurrency to avoid CPU spikes
    const imageMime = (typeof framesMime === "string" && framesMime.startsWith("image/")) ? framesMime : "image/png";
    const CONCURRENCY = 2; // limit fan-out to reduce CPU time per request

    const imagesAll: string[] = [];
    for (let i = 0; i < count; i += CONCURRENCY) {
      const batchSize = Math.min(CONCURRENCY, count - i);
      const batch = Array.from({ length: batchSize }, () =>
        generateImagesWithGemini(apiKey, prompt, frames, imageMime, layoutImage)
      );
      const settled = await Promise.allSettled(batch);
      imagesAll.push(...settled.flatMap((s) => s.status === "fulfilled" ? s.value : []));
    }

    if (imagesAll.length === 0) {
      return Response.json(
        { error: "Failed to generate any images" },
        { status: 500 }
      );
    }

    // Track credit usage equal to the variant count after a successful generation
    // We've configured Gemini to return exactly 1 image per API call
    // Log both values for monitoring
    const actualImagesGenerated = imagesAll.length;
    if (autumn) {
      try {
        await autumn.track({ customer_id, feature_id: FEATURE_ID, value: count });
        console.log(`Tracked ${count} credits (requested: ${count} variants, generated: ${actualImagesGenerated} images)`);

        // Alert if mismatch detected
        if (actualImagesGenerated !== count) {
          console.warn(`⚠️ Image count mismatch! Expected ${count} images but got ${actualImagesGenerated}. User was charged for ${count}.`);
        }
      } catch (e) {
        console.warn("Autumn track failed; continuing without failing request", e);
      }
    }

    // Return images as data URLs for direct client use
    // Note: Dimension enforcement will be handled on the client side
    const dataUrls = imagesAll.map(base64 => `data:image/png;base64,${base64}`);

    return Response.json({ images: dataUrls });
  } catch (err: unknown) {
    console.error("/api/generate error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
