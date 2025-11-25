// Use edge runtime for Cloudflare Pages compatibility
export const runtime = "edge";

import { getUser, createAuthToken } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";
import { Autumn } from "autumn-js";
import { fal } from "@fal-ai/client";
import { FAL_MODEL_FLUX, FAL_MODEL_QWEN, FalModel, Provider, SingleProvider } from "@/lib/types/refinement";

// Use Gemini 3 Pro Image Preview - Google's most advanced image generation model (November 2025)
const MODEL_ID = "gemini-3-pro-image-preview";

// Credit costs per provider
const PROVIDER_CREDITS: Record<SingleProvider, number> = {
  'gemini': 4,
  'fal-flux': 1,
  'fal-qwen': 1,
};

// Result type with provider label
interface LabeledImage {
  url: string;
  provider: SingleProvider;
}

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

async function generateImagesWithFal(
  apiKey: string,
  prompt: string,
  frames: string[],
  model: FalModel = FAL_MODEL_FLUX
): Promise<string[]> {
  fal.config({
    credentials: apiKey
  });

  try {
    // Use the first frame as the reference image
    const referenceFrame = frames[0];
    const dataUrl = `data:image/png;base64,${referenceFrame}`;

    // Build input based on model type
    // Flux uses image_urls (array), Qwen uses image_url (singular)
    const isQwen = model === FAL_MODEL_QWEN;
    const input = isQwen
      ? {
          prompt,
          image_url: dataUrl, // Qwen uses singular image_url
          output_format: "png",
        }
      : {
          prompt,
          image_urls: [dataUrl], // Flux uses plural image_urls
          image_size: "landscape_16_9",
          output_format: "png",
          sync_mode: false
        };

    // Use specified model (Flux or Qwen)
    const result = await fal.subscribe(model, {
      input,
      logs: false,
    }) as { data: { images: Array<{ url: string }> } };

    if (!result.data.images || result.data.images.length === 0) {
      throw new Error("No images generated");
    }

    // Fetch the image and convert to base64
    const images: string[] = [];
    for (const img of result.data.images) {
      const imageResponse = await fetch(img.url);
      const imageBuffer = await imageResponse.arrayBuffer();
      // Convert ArrayBuffer to base64 using Web APIs (Edge runtime compatible)
      const uint8Array = new Uint8Array(imageBuffer);
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binaryString);
      images.push(base64);
    }

    return images;
  } catch (error) {
    console.error(`Fal generation error (${model}):`, error);
    throw new Error(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    const { prompt, frames = [], layoutImage, variants, framesMime, source, providers, model } = await req.json();

    // Normalize providers - support both array and legacy single provider format
    let providersArray: SingleProvider[];
    if (Array.isArray(providers) && providers.length > 0) {
      providersArray = providers.filter((p: string) => ['gemini', 'fal-flux', 'fal-qwen'].includes(p)) as SingleProvider[];
    } else if (typeof providers === 'string' && providers === 'all') {
      providersArray = ['gemini', 'fal-flux', 'fal-qwen'];
    } else if (typeof providers === 'string') {
      providersArray = [providers as SingleProvider];
    } else {
      providersArray = ['gemini']; // default
    }

    if (providersArray.length === 0) {
      return Response.json(
        { error: "At least one valid provider must be selected" },
        { status: 400 }
      );
    }

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
            source: source || 'thumbnails',
            providers: providersArray,
            model
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

    // Use already-validated providersArray
    const providersToUse: SingleProvider[] = providersArray;

    // Get API keys
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const falKey = process.env.FAL_KEY;

    // Check if required keys are available for selected providers
    const needsGemini = providersToUse.includes('gemini');
    const needsFal = providersToUse.includes('fal-flux') || providersToUse.includes('fal-qwen');

    if (needsGemini && !geminiKey) {
      return Response.json(
        { error: "Gemini service temporarily unavailable" },
        { status: 503 }
      );
    }
    if (needsFal && !falKey) {
      return Response.json(
        { error: "Fal AI service temporarily unavailable" },
        { status: 503 }
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

    // Calculate total credits: sum of credits for each provider
    // For 'all' provider, each provider generates 1 variant
    const count = Math.max(1, Math.min(Number(variants) || 1, 8));
    const totalCreditsRequired = providersToUse.reduce((sum, p) => {
      return sum + (count * PROVIDER_CREDITS[p]);
    }, 0);

    let allowed = true;
    let autumn: Autumn | null = null;
    if (autumnEnabled) {
      autumn = new Autumn({ secretKey: secretKey as string });
      try {
        const checkRes = await autumn.check({ customer_id, feature_id: FEATURE_ID, required_balance: totalCreditsRequired });
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
          { error: "Insufficient credits", code: "insufficient_credits", feature_id: FEATURE_ID, required: totalCreditsRequired },
          { status: 402 }
        );
      }
    }

    // Run generation for each provider in parallel
    const imageMime = (typeof framesMime === "string" && framesMime.startsWith("image/")) ? framesMime : "image/png";

    // Helper to generate for a single provider
    async function generateForProvider(p: SingleProvider): Promise<LabeledImage[]> {
      const results: LabeledImage[] = [];

      for (let i = 0; i < count; i++) {
        try {
          let images: string[] = [];
          if (p === 'gemini') {
            images = await generateImagesWithGemini(geminiKey!, prompt, frames, imageMime, layoutImage);
          } else if (p === 'fal-flux') {
            images = await generateImagesWithFal(falKey!, prompt, frames, FAL_MODEL_FLUX);
          } else if (p === 'fal-qwen') {
            images = await generateImagesWithFal(falKey!, prompt, frames, FAL_MODEL_QWEN);
          }
          for (const base64 of images) {
            results.push({ url: `data:image/png;base64,${base64}`, provider: p });
          }
        } catch (error) {
          console.error(`Error generating with ${p}:`, error);
        }
      }
      return results;
    }

    // Generate with all providers in parallel
    const providerResults = await Promise.all(
      providersToUse.map(p => generateForProvider(p))
    );

    // Flatten results
    const allImages: LabeledImage[] = providerResults.flat();

    if (allImages.length === 0) {
      return Response.json(
        { error: "Failed to generate any images" },
        { status: 500 }
      );
    }

    // Track credit usage after a successful generation
    const actualImagesGenerated = allImages.length;
    if (autumn) {
      try {
        await autumn.track({ customer_id, feature_id: FEATURE_ID, value: totalCreditsRequired });
        console.log(`Tracked ${totalCreditsRequired} credits (providers: ${providersToUse.join(', ')}, generated: ${actualImagesGenerated} images)`);
      } catch (e) {
        console.warn("Autumn track failed; continuing without failing request", e);
      }
    }

    // Return labeled images for UI to display with provider info
    return Response.json({
      images: allImages.map(img => img.url),
      labeledImages: allImages,
      totalCredits: totalCreditsRequired
    });
  } catch (err: unknown) {
    console.error("/api/generate error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
