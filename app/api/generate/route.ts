// Use edge runtime for Cloudflare Pages compatibility
export const runtime = "edge";

import { getUser } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";
import { Autumn } from "autumn-js";

// Use Gemini 2.5 Flash Image via generateContent (lightweight, "Nano/Banana" family)
const MODEL_ID = "gemini-2.5-flash-image-preview";

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
    });

    // Extract base64 image data from inlineData parts
    const images: string[] = [];
    const resParts: any[] = (result as any)?.candidates?.[0]?.content?.parts ?? [];
    for (const part of resParts) {
      const b64 = part?.inlineData?.data as string | undefined;
      if (typeof b64 === 'string' && b64.length > 0) {
        images.push(b64);
      }
    }

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
    if (process.env.NEXT_PUBLIC_WORKER_API_URL) {
      const workerUrl = process.env.NEXT_PUBLIC_WORKER_API_URL;

      // Create auth token for worker API
      const authToken = Buffer.from(JSON.stringify({
        email: user.email,
        name: user.name || '',
        picture: user.picture || '',
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
      })).toString('base64');

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
        const error = await workerRes.json().catch(() => ({ error: 'Worker API error' }));
        return Response.json(error, { status: workerRes.status });
      }

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
    if (autumn) {
      try {
        await autumn.track({ customer_id, feature_id: FEATURE_ID, value: count });
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
