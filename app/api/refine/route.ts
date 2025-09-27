// Use edge runtime for Cloudflare Pages compatibility
export const runtime = "edge";

import { getUser } from "@/lib/auth";
// Pollinations: no SDK required
import { Autumn } from "autumn-js";
import { RefinementRequest, RefinementResponse, RefinementIteration, RefinementUtils } from "@/lib/types/refinement";

// Refinement powered by Pollinations image API

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

    // Convert SVG to base64
    const mockImageBase64 = Buffer.from(mockImageSvg).toString('base64');

    return mockImageBase64;

  } catch (error) {
    console.error('Error creating mock refined image:', error);
    // Fallback: return original image
    return baseImageBase64;
  }
}

async function refineImageWithPollinations(
  combinedPrompt: string,
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

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(combinedPrompt)}?${params.toString()}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Pollinations refinement failed: ${res.status} ${res.statusText}`);
  }
  const ab = await res.arrayBuffer();
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

    // Use mock in non-production to preserve fast UI iteration
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (isDevelopment) {
      // In development mode, create a mock refined image by applying a simple visual modification
      // This simulates the refinement process for UI testing
      refinedImageBase64 = await createMockRefinedImage(baseImageData, feedbackPrompt);
    } else {
      // Generate refined image using Pollinations API
      const seed = Math.floor(Math.random() * 1_000_000);
      refinedImageBase64 = await refineImageWithPollinations(
        combinedPrompt,
        1280,
        720,
        seed,
        process.env.NEXT_PUBLIC_APP_REFERRER
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
    const mimeType = isDevelopment ? 'image/svg+xml' : 'image/jpeg';
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
    return Response.json(
      { 
        success: false, 
        error: err instanceof Error ? err.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
