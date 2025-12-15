// Use edge runtime for Cloudflare Pages compatibility
export const runtime = "edge";

import { getUser } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";
import { Autumn } from "autumn-js";
import { fal } from "@fal-ai/client";
import { RefinementRequest, RefinementResponse, RefinementIteration, RefinementUtils, FAL_MODEL_FLUX, FAL_MODEL_QWEN, FalModel, SingleProvider } from "@/lib/types/refinement";

// Use Gemini 3 Pro Image Preview - Google's most advanced image generation model (November 2025)
const MODEL_ID = "gemini-3-pro-image-preview";

/**
 * Custom error class for validation errors.
 * These represent user-correctable input issues and should return HTTP 400.
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Gemini supports a limited set of image MIME types for inline data
const GEMINI_SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
]);

/**
 * Validates that a MIME type is supported by Gemini for inline image data.
 * Returns true if supported, false otherwise.
 */
function isGeminiSupportedImageMimeType(mimeType: string): boolean {
  return GEMINI_SUPPORTED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

// Function to create a mock refined image for development mode
async function createMockRefinedImage(baseImageBase64: string, feedbackPrompt: string): Promise<string> {
  // In development mode, we'll create a simple visual modification to simulate refinement
  // This creates a mock image with a colored background and text overlay to show the refinement worked

  try {
    // Generate a random color based on the feedback prompt for variety
    const hash = feedbackPrompt.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const color = Math.abs(hash).toString(16).substring(0, 6).padStart(6, '0');

    // Create a simple mock image with SVG
    const mockImageSvg = `
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#${color}"/>
        <rect x="50" y="50" width="1180" height="620" fill="rgba(0,0,0,0.7)" stroke="white" stroke-width="4"/>
        <text x="640" y="300" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">
          REFINED IMAGE
        </text>
        <text x="640" y="360" font-family="Arial, sans-serif" font-size="32" fill="white" text-anchor="middle">
          Feedback: ${feedbackPrompt.substring(0, 40)}${feedbackPrompt.length > 40 ? '...' : ''}
        </text>
        <text x="640" y="420" font-family="Arial, sans-serif" font-size="24" fill="#ccc" text-anchor="middle">
          (Development Mock - Iteration ${Math.floor(Math.random() * 10) + 1})
        </text>
      </svg>
    `;

    // Convert SVG to base64 using Web APIs (Edge runtime compatible)
    const encoder = new TextEncoder();
    const svgBytes = encoder.encode(mockImageSvg);
    let binaryString = '';
    for (let i = 0; i < svgBytes.length; i++) {
      binaryString += String.fromCharCode(svgBytes[i]);
    }
    const mockImageBase64 = btoa(binaryString);

    return mockImageBase64;

  } catch (error) {
    console.error('Error creating mock refined image:', error);
    // Fallback: return original image
    return baseImageBase64;
  }
}

async function refineImageWithGemini(
  apiKey: string,
  baseImageData: string,
  combinedPrompt: string,
  imageMime: string = "image/png",
  referenceImages?: string[]
): Promise<string> {
  const genAI = new GoogleGenAI({ apiKey });

  try {
    // Build request parts: base image first, then reference images, then the combined prompt
    const reqParts: Array<{ inlineData?: { mimeType: string; data: string } } | { text: string }> = [];

    // Add the base image
    reqParts.push({ inlineData: { mimeType: imageMime, data: baseImageData } });

    // Add reference images if provided
    if (referenceImages && referenceImages.length > 0) {
      for (let i = 0; i < referenceImages.length; i++) {
        const refImg = referenceImages[i];
        let base64Data: string;
        let refMimeType = "image/png"; // Default to PNG if no MIME type info

        if (refImg.startsWith('data:')) {
          // Extract MIME type from data URL (e.g., "data:image/jpeg;base64,...")
          const mimeMatch = refImg.match(/^data:([^;,]+)/);
          if (mimeMatch && mimeMatch[1]) {
            refMimeType = mimeMatch[1];
          }
          // Extract base64 data after the comma
          const extractedData = refImg.split(',')[1];
          // Validate that base64 data exists and is not empty
          if (!extractedData || extractedData.trim().length === 0) {
            throw new ValidationError(
              `Reference image ${i + 1} has an empty or invalid data payload. ` +
              `Please re-upload the image.`
            );
          }
          base64Data = extractedData;
        } else {
          // For raw base64 strings (not data URLs), validate they're not empty
          if (!refImg || refImg.trim().length === 0) {
            throw new ValidationError(
              `Reference image ${i + 1} has empty image data. ` +
              `Please re-upload the image.`
            );
          }
          base64Data = refImg;
        }

        // Validate MIME type is supported by Gemini
        if (!isGeminiSupportedImageMimeType(refMimeType)) {
          const supportedTypes = Array.from(GEMINI_SUPPORTED_IMAGE_MIME_TYPES).join(', ');
          throw new ValidationError(
            `Reference image ${i + 1} has unsupported format "${refMimeType}". ` +
            `Gemini only supports: ${supportedTypes}. Please convert the image to a supported format.`
          );
        }

        reqParts.push({ inlineData: { mimeType: refMimeType, data: base64Data } });
      }
    }

    // Add the combined prompt
    reqParts.push({ text: combinedPrompt });

    const result = await genAI.models.generateContent({
      model: MODEL_ID,
      contents: [{ parts: reqParts }],
    });

    // Extract generated images from response (same format as generation API)
    const images: string[] = [];
    const resParts: any[] = (result as any)?.candidates?.[0]?.content?.parts ?? [];
    for (const part of resParts) {
      const b64 = part?.inlineData?.data as string | undefined;
      if (typeof b64 === 'string' && b64.length > 0) {
        images.push(b64);
      }
    }

    if (images.length === 0) {
      throw new Error("No images generated");
    }

    // Return the first generated image
    return images[0];
  } catch (error) {
    console.error("Gemini refinement error:", error);
    // Re-throw ValidationError without wrapping so the route handler can return HTTP 400
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error(`Image refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function refineImageWithFal(
  apiKey: string,
  baseImageData: string,
  feedbackPrompt: string,
  referenceImages?: string[],
  provider?: SingleProvider
): Promise<string> {
  // Configure Fal client
  fal.config({
    credentials: apiKey
  });

  try {
    // Convert base64 to data URL for Fal AI
    const dataUrl = `data:image/png;base64,${baseImageData}`;

    // Build image_urls array: base image first, then reference images
    const imageUrls = [dataUrl];
    if (referenceImages && referenceImages.length > 0) {
      // Add reference images (convert to data URLs if needed)
      referenceImages.forEach(refImg => {
        const refDataUrl = refImg.startsWith('data:')
          ? refImg
          : `data:image/png;base64,${refImg}`;
        imageUrls.push(refDataUrl);
      });
    }

    // Use Flux model for fal-flux, Qwen for fal-qwen
    const falModel = provider === 'fal-qwen' ? FAL_MODEL_QWEN : FAL_MODEL_FLUX;
    const isQwen = falModel === FAL_MODEL_QWEN;

    // Build input based on model type
    // Flux uses image_urls (array), Qwen uses image_url (singular)
    const input = isQwen
      ? {
          prompt: feedbackPrompt,
          image_url: imageUrls[0], // Qwen uses singular image_url
          output_format: "png",
        }
      : {
          prompt: feedbackPrompt,
          image_urls: imageUrls, // Flux uses plural image_urls
          image_size: "landscape_16_9",
          output_format: "png",
          sync_mode: false
        };

    const result = await fal.subscribe(falModel, {
      input,
      logs: false,
    }) as { data: { images: Array<{ url: string }> } };

    if (!result.data.images || result.data.images.length === 0) {
      throw new Error("No images generated");
    }

    // Fetch the image and convert to base64
    const imageUrl = result.data.images[0].url;
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    // Convert ArrayBuffer to base64 using Web APIs (Edge runtime compatible)
    const uint8Array = new Uint8Array(imageBuffer);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binaryString);

    return base64;
  } catch (error) {
    console.error("Fal refinement error:", error);
    throw new Error(`Image refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const requestData: RefinementRequest = await req.json();
    const {
      baseImageUrl,
      baseImageData,
      originalPrompt,
      feedbackPrompt,
      templateId,
      parentIterationId,
      provider = 'gemini', // Default to Gemini for backward compatibility
      referenceImages = [], // Optional reference images for Fal AI
      model,
    } = requestData;

    // Validate required fields
    if (!baseImageData || !originalPrompt || !feedbackPrompt || !templateId) {
      return Response.json(
        { success: false, error: "Missing required fields: baseImageData, originalPrompt, feedbackPrompt, templateId" },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders: SingleProvider[] = ['gemini', 'fal-flux', 'fal-qwen'];
    if (!validProviders.includes(provider as SingleProvider)) {
      return Response.json(
        { success: false, error: "Invalid provider. Must be 'gemini', 'fal-flux', or 'fal-qwen'" },
        { status: 400 }
      );
    }

    // Get API key based on provider
    let apiKey: string | undefined;
    if (provider === 'fal-flux' || provider === 'fal-qwen') {
      apiKey = process.env.FAL_KEY;
      if (!apiKey) {
        return Response.json(
          { success: false, error: "Service temporarily unavailable" },
          { status: 503 }
        );
      }
    } else {
      apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        return Response.json(
          { success: false, error: "Service temporarily unavailable" },
          { status: 503 }
        );
      }
    }

    // Autumn credit check: Gemini costs 4 credits, Fal AI costs 1 credit
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

    // Credit cost depends on provider: Gemini = 4 credits, Fal AI = 1 credit
    const creditsRequired = provider === 'gemini' ? 4 : 1;

    let allowed = true;
    let autumn: Autumn | null = null;
    let creditsRemaining = 999; // Default for development

    if (autumnEnabled) {
      autumn = new Autumn({ secretKey: secretKey as string });
      try {
        const checkRes = await autumn.check({ customer_id, feature_id: FEATURE_ID, required_balance: creditsRequired });
        allowed = !!checkRes?.data?.allowed;
        
        // Get current balance for response
        if (checkRes?.data?.balance !== undefined && checkRes.data.balance !== null) {
          creditsRemaining = checkRes.data.balance;
        }
      } catch (e) {
        if (process.env.NODE_ENV === "production") {
          return Response.json(
            { success: false, error: "Billing service unavailable. Please try again.", code: "billing_unavailable" },
            { status: 503 }
          );
        } else {
          console.warn("Autumn check failed in development; bypassing credit gate:", e);
        }
      }
      if (!allowed) {
        return Response.json(
          { 
            success: false, 
            error: "Insufficient credits", 
            code: "insufficient_credits", 
            feature_id: FEATURE_ID, 
            required: creditsRequired,
            creditsRemaining: creditsRemaining
          },
          { status: 402 }
        );
      }
    }

    // Create combined prompt for refinement
    const combinedPrompt = `${originalPrompt}

REFINEMENT REQUEST: ${feedbackPrompt}

Please apply the refinement request to modify the image while maintaining the overall style and composition from the original prompt.`;



    // Check if we're in development mode - use mock for testing UI flow
    let refinedImageBase64: string;

    // Only use mock when API key is placeholder, not based on NODE_ENV
    const isDevelopment = apiKey === 'placeholder-for-testing';

    if (isDevelopment) {
      // In development mode, create a mock refined image by applying a simple visual modification
      // This simulates the refinement process for UI testing
      refinedImageBase64 = await createMockRefinedImage(baseImageData, feedbackPrompt);
    } else if (provider === 'fal-flux' || provider === 'fal-qwen') {
      // Generate refined image using Fal AI
      refinedImageBase64 = await refineImageWithFal(
        apiKey,
        baseImageData,
        feedbackPrompt,
        referenceImages,
        provider
      );
    } else {
      // Generate refined image using Gemini API
      refinedImageBase64 = await refineImageWithGemini(
        apiKey,
        baseImageData,
        combinedPrompt,
        "image/png",
        referenceImages
      );
    }

    // Track credit usage after successful refinement
    if (autumn) {
      try {
        await autumn.track({ customer_id, feature_id: FEATURE_ID, value: creditsRequired });
        creditsRemaining = Math.max(0, creditsRemaining - creditsRequired);
      } catch (e) {
        console.warn("Autumn track failed; continuing without failing request", e);
      }
    }

    // Create refinement iteration
    const iterationId = RefinementUtils.generateIterationId();

    // Determine the correct MIME type based on development vs production
    const mimeType = isDevelopment ? 'image/svg+xml' : 'image/png';
    const refinedImageUrl = `data:${mimeType};base64,${refinedImageBase64}`;

    const iteration: RefinementIteration = {
      id: iterationId,
      parentId: parentIterationId,
      originalPrompt,
      feedbackPrompt,
      combinedPrompt,
      imageUrl: refinedImageUrl,
      imageData: refinedImageBase64,
      templateId,
      createdAt: Date.now(),
      creditsUsed: creditsRequired,
    };

    const response: RefinementResponse = {
      success: true,
      iteration,
      creditsRemaining,
    };

    return Response.json(response);
  } catch (err: unknown) {
    console.error("/api/refine error", err);

    // Return 400 for validation errors (user-correctable input issues)
    if (err instanceof ValidationError) {
      return Response.json(
        {
          success: false,
          error: err.message
        },
        { status: 400 }
      );
    }

    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
