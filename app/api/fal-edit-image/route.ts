// Use edge runtime for Cloudflare Pages compatibility
export const runtime = "edge";

import { getUser } from "@/lib/auth";
import { fal } from "@fal-ai/client";
import { FAL_MODEL_FLUX, FAL_MODEL_QWEN, FalModel } from "@/lib/types/refinement";

interface FalEditImageRequest {
  prompt: string;
  image_urls: string[];
  model?: FalModel;
  image_size?: string | { width: number; height: number };
  enable_prompt_expansion?: boolean;
  seed?: number;
  output_format?: "jpeg" | "png" | "webp";
  sync_mode?: boolean;
}

interface FalImageFile {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
  width?: number;
  height?: number;
}

interface FalEditImageResponse {
  images: FalImageFile[];
  seed: number;
}

export async function POST(request: Request) {
  try {
    // Check authentication - bypass in development
    let user = getUser(request);
    if (!user && process.env.NODE_ENV === 'development') {
      // Use mock user in development
      user = {
        email: 'dev@example.com',
        name: 'Dev User',
        picture: '',
      };
    }
    if (!user) {
      return Response.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    // Get Fal API key from environment
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return Response.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }

    // Configure Fal client
    fal.config({
      credentials: falKey
    });

    // Parse request body
    const body = await request.json();
    const {
      prompt,
      image_urls,
      model,
      image_size = "auto",
      enable_prompt_expansion = false,
      seed,
      output_format = "png",
      sync_mode = false
    }: FalEditImageRequest = body;

    // Validate required fields
    if (!prompt || !image_urls || !Array.isArray(image_urls) || image_urls.length === 0) {
      return Response.json(
        { error: "Missing required fields: prompt and image_urls" },
        { status: 400 }
      );
    }

    // Use specified model or default to Flux
    const modelToUse = model || FAL_MODEL_FLUX;
    // Call Fal AI API
    const result = await fal.subscribe(modelToUse, {
      input: {
        prompt,
        image_urls,
        image_size,
        enable_prompt_expansion,
        seed,
        output_format,
        sync_mode
      },
      logs: false,
    }) as { data: FalEditImageResponse; requestId: string };

    // Return the result
    return Response.json({
      success: true,
      images: result.data.images,
      seed: result.data.seed,
      requestId: result.requestId
    });

  } catch (error: any) {
    // Handle specific error types
    if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
      return Response.json(
        { error: "Service authentication failed" },
        { status: 503 }
      );
    }

    if (error.message?.includes("429") || error.message?.includes("rate limit")) {
      return Response.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return Response.json(
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
}

