export const runtime = "edge";


import { autumnHandler } from "autumn-js/next";
import { getUser } from "@/lib/auth";

export const { GET, POST } = autumnHandler({
  secretKey: process.env.AUTUMN_SECRET_KEY,
  identify: async (request) => {
    let user = getUser(request);

    // In development, use mock user if no real user found
    if (!user && process.env.NODE_ENV === 'development') {
      user = {
        email: 'dev@example.com',
        name: 'Dev User',
        picture: '',
      };
    }

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

