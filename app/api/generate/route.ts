// Use edge runtime for Cloudflare Pages compatibility
export const runtime = "edge";

import { getUser } from "@/lib/auth";
// Pollinations: no SDK required
import { Autumn } from "autumn-js";

// Pollinations image generation
async function generateImageWithPollinations(
  prompt: string,
  width: number = 1280,
  height: number = 720,
  seed?: number,
  referrer?: string
): Promise<string> {
  const params = new URLSearchParams();
  params.set("width", String(width));
  params.set("height", String(height));
  params.set("model", "flux");
  if (typeof seed === "number") params.set("seed", String(seed));
  const ref = referrer || process.env.NEXT_PUBLIC_APP_REFERRER;
  if (ref) params.set("referrer", ref);

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Pollinations request failed: ${res.status} ${res.statusText}`);
  }
  const ab = await res.arrayBuffer();
  // Return base64 (caller will wrap as data URL)
  // Pollinations typically returns JPEG
  // Edge runtimes support Buffer via polyfill; if not available, use btoa on binary string
  const b64 = Buffer.from(ab).toString("base64");
  return b64;
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

    const { prompt, frames = [], layoutImage, variants, framesMime } = await req.json();

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return Response.json(
        { error: "Missing prompt" },
        { status: 400 }
      );
    }

    // Frames are optional for Pollinations; we keep accepting them for compatibility but do not require

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
      const batch = Array.from({ length: batchSize }, () => {
        const seed = Math.floor(Math.random() * 1_000_000);
        return generateImageWithPollinations(prompt, 1280, 720, seed, process.env.NEXT_PUBLIC_APP_REFERRER);
      });
      const settled = await Promise.allSettled(batch);
      for (const s of settled) {
        if (s.status === "fulfilled" && s.value) imagesAll.push(s.value);
      }
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
    const dataUrls = imagesAll.map(base64 => `data:image/jpeg;base64,${base64}`);

    return Response.json({ images: dataUrls });
  } catch (err: unknown) {
    console.error("/api/generate error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
