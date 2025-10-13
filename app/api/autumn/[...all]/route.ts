export const runtime = "edge";

import { autumnHandler } from "autumn-js/next";
import { getUser } from "@/lib/auth";
import { Autumn } from "autumn-js";

// In development mode, disable Autumn entirely
const isDevelopment = process.env.NODE_ENV === 'development';

const developmentHandlers = {
  GET: async () => new Response('Not Found', { status: 404 }),
  POST: async () => new Response('Not Found', { status: 404 })
};

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

const productionHandlers = autumnHandler({
  secretKey: process.env.AUTUMN_SECRET_KEY,
  identify: async (request) => {
    const user = getUser(request);

    if (!user) {
      // Return null to let handler treat as unauthenticated; clients can send { errorOnNotFound: false }
      return null;
    }

    // Autumn customer IDs must be URL/slug-safe and reasonably short
    const raw = user.email.toLowerCase();
    const cleaned = raw.replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_]+/, "")
      .replace(/[-_]+$/, "");
    // Ensure starts with a letter prefix and keep length conservative (<= 40)
    const safeId = ("u-" + cleaned).slice(0, 40);

    // Debug logging
    console.log(`[Autumn] Deriving customer ID for email: ${user.email}`);
    console.log(`[Autumn] Derived customer ID: ${safeId}`);

    return {
      customerId: safeId,
      customerData: { name: user.name || "", email: user.email },
    };
  },
});

// Custom handler to wrap the autumnHandler and add balance to POST responses
async function customGET(request: Request) {
  return productionHandlers.GET(request);
}

async function customPOST(request: Request) {
  const response = await productionHandlers.POST(request);

  // If the response is successful, try to add balance information
  if (response.status === 200) {
    try {
      // Clone the response so we can read the body
      const clonedResponse = response.clone();
      const data = await clonedResponse.json();
      const user = getUser(request);

      if (user && process.env.AUTUMN_SECRET_KEY) {
        // Derive customer ID
        const raw = user.email.toLowerCase();
        const cleaned = raw.replace(/[^a-z0-9_-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^[-_]+/, "")
          .replace(/[-_]+$/, "");
        const customerId = ("u-" + cleaned).slice(0, 40);

        // Fetch balance from Autumn
        const autumn = new Autumn({ secretKey: process.env.AUTUMN_SECRET_KEY });
        try {
          const checkRes = await autumn.check({ customer_id: customerId, feature_id: FEATURE_ID });

          // Return response with balance included
          return new Response(
            JSON.stringify({
              ...data,
              balance: checkRes?.data?.balance || 0,
              allowed: checkRes?.data?.allowed || false,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        } catch (e) {
          console.warn("Failed to fetch balance for POST response:", e);
          // Return original response if balance fetch fails
          return response;
        }
      }
    } catch (e) {
      console.warn("Failed to enhance POST response with balance:", e);
      // Return original response if anything goes wrong
      return response;
    }
  }

  return response;
}

export const GET = isDevelopment ? developmentHandlers.GET : customGET;
export const POST = isDevelopment ? developmentHandlers.POST : customPOST;

