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
    // Require authentication
    const user = getUser(req);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, frames = [], layoutImage, variants, framesMime } = await req.json();

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

    const autumn = new Autumn({ secretKey: process.env.AUTUMN_SECRET_KEY });

    // Each request consumes credits equal to the variant count
    const count = Math.max(1, Math.min(Number(variants) || 1, 8));

    const checkRes = await autumn.check({ customer_id, feature_id: FEATURE_ID, required_balance: count });
    if (!checkRes?.data?.allowed) {
      return Response.json(
        { error: "Insufficient credits", code: "insufficient_credits", feature_id: FEATURE_ID, required: count },
        { status: 402 }
      );
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
    await autumn.track({ customer_id, feature_id: FEATURE_ID, value: count });

    // Return images as data URLs for direct client use
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
