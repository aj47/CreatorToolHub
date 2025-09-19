// Use edge runtime for Cloudflare Pages compatibility
export const runtime = "edge";

import { getUser } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";
import { Autumn } from "autumn-js";
import { RefinementRequest, RefinementResponse, RefinementIteration, RefinementUtils } from "@/lib/types/refinement";

// Use Gemini 2.5 Flash Image via generateContent
const MODEL_ID = "gemini-2.5-flash-image-preview";

async function refineImageWithGemini(
  apiKey: string,
  baseImageData: string,
  combinedPrompt: string,
  imageMime: string = "image/png"
): Promise<string> {
  const genAI = new GoogleGenAI({ apiKey });

  try {
    // Build request parts: base image first, then the combined prompt
    const reqParts: Array<{ inlineData?: { mimeType: string; data: string } } | { text: string }> = [];
    
    // Add the base image
    reqParts.push({ inlineData: { mimeType: imageMime, data: baseImageData } });
    
    // Add the combined prompt
    reqParts.push({ text: combinedPrompt });

    const result = await genAI.models.generateContent({
      model: MODEL_ID,
      contents: [{ parts: reqParts }],
    });

    // Extract generated images from response
    const images: string[] = [];
    const candidates = result.response?.candidates || [];
    
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          images.push(part.inlineData.data);
        }
      }
    }

    if (images.length === 0) {
      throw new Error("No images generated");
    }

    // Return the first generated image
    return images[0];
  } catch (error) {
    console.error("Gemini refinement error:", error);
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
      parentIterationId 
    } = requestData;

    // Validate required fields
    if (!baseImageData || !originalPrompt || !feedbackPrompt || !templateId) {
      return Response.json(
        { success: false, error: "Missing required fields: baseImageData, originalPrompt, feedbackPrompt, templateId" },
        { status: 400 }
      );
    }

    // Get API key
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return Response.json(
        { success: false, error: "Missing GEMINI_API_KEY or GOOGLE_API_KEY" },
        { status: 500 }
      );
    }

    // Autumn credit check: each refinement costs 1 credit
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

    // Each refinement consumes 1 credit
    const creditsRequired = 1;

    let allowed = true;
    let autumn: Autumn | null = null;
    let creditsRemaining = 999; // Default for development

    if (autumnEnabled) {
      autumn = new Autumn({ secretKey: secretKey as string });
      try {
        const checkRes = await autumn.check({ customer_id, feature_id: FEATURE_ID, required_balance: creditsRequired });
        allowed = !!checkRes?.data?.allowed;
        
        // Get current balance for response
        if (checkRes?.data?.balance !== undefined) {
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

    // Debug: Log the baseImageData to see what we're receiving
    console.log("Received baseImageData type:", typeof baseImageData);
    console.log("Received baseImageData length:", baseImageData?.length || 0);
    console.log("Received baseImageData starts with:", baseImageData?.substring(0, 50) || "undefined");
    console.log("API Key:", apiKey);
    console.log("API Key comparison:", apiKey === 'placeholder-for-testing');

    // Check if we're in development mode - use mock for testing UI flow
    let refinedImageBase64: string;

    // For development/testing purposes, use mock response to test UI flow
    const isDevelopment = process.env.NODE_ENV === 'development' || apiKey === 'placeholder-for-testing';

    if (isDevelopment) {
      console.log("Development mode: Using mock refinement response");
      // In development mode, return the original image as the "refined" version
      // This allows testing the UI flow without requiring a working API key
      refinedImageBase64 = baseImageData;
    } else {
      console.log("Production mode: Using real Gemini API");
      // Generate refined image using real Gemini API
      refinedImageBase64 = await refineImageWithGemini(
        apiKey,
        baseImageData,
        combinedPrompt,
        "image/png"
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
    const refinedImageUrl = `data:image/png;base64,${refinedImageBase64}`;

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
    return Response.json(
      { 
        success: false, 
        error: err instanceof Error ? err.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
