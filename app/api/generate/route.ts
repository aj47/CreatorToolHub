// Use nodejs runtime for @google/genai compatibility
export const runtime = "nodejs";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { GoogleGenAI } from "@google/genai";

const MODEL_ID = "gemini-2.0-flash-exp";

async function generateImagesWithGemini(
  apiKey: string,
  prompt: string,
  _frames: string[],
  _layoutImage?: string
): Promise<string[]> {
  const genAI = new GoogleGenAI({ apiKey });

  try {
    // For now, use just the text prompt - image input may need different API
    const result = await genAI.models.generateImages({
      model: MODEL_ID,
      prompt: prompt
    });

    // Extract base64 image data from response
    const images: string[] = [];

    // Handle different possible response structures
    if ((result as any).images) {
      for (const image of (result as any).images) {
        if (image.data) {
          images.push(image.data);
        }
      }
    } else if ((result as any).generatedImages) {
      for (const image of (result as any).generatedImages) {
        if (image.data) {
          images.push(image.data);
        }
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
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, frames = [], layoutImage } = await req.json();

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

    // Note: Current Gemini API doesn't support specifying count, generates 1 image
    // const count = Math.max(1, Math.min(Number(variants) || 4, 8));
    const images = await generateImagesWithGemini(apiKey, prompt, frames, layoutImage);

    if (images.length === 0) {
      return Response.json(
        { error: "Failed to generate any images" },
        { status: 500 }
      );
    }

    // Return images as data URLs for direct client use
    const dataUrls = images.map(base64 => `data:image/png;base64,${base64}`);

    return Response.json({ images: dataUrls });
  } catch (err: unknown) {
    console.error("/api/generate error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
