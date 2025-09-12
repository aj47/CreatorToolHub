export const runtime = "edge";

import { autumnHandler } from "autumn-js/next";
import { getUser } from "@/lib/auth";

// In development mode, disable Autumn entirely
if (process.env.NODE_ENV === 'development') {
  // Return mock handlers that always return 404 for development
  export const GET = async () => new Response('Not Found', { status: 404 });
  export const POST = async () => new Response('Not Found', { status: 404 });
} else {
  export const { GET, POST } = autumnHandler({
    secretKey: process.env.AUTUMN_SECRET_KEY,
    identify: async (request) => {
      let user = getUser(request);

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

      return {
        customerId: safeId,
        customerData: { name: user.name || "", email: user.email },
      };
    },
  });
}

