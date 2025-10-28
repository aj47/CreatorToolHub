export const runtime = "edge";

import { autumnHandler } from "autumn-js/next";
import { getUser } from "@/lib/auth";

// In development mode, return mock data instead of 404
const isDevelopment = process.env.NODE_ENV === 'development';

export const { GET, POST } = autumnHandler({
  identify: async (request) => {
    // In development, return mock user
    if (isDevelopment) {
      return {
        customerId: "dev-user",
        customerData: {
          name: "Dev User",
          email: "dev@example.com",
        },
      };
    }

    // Get the user from your auth provider
    const user = getUser(request);

    if (!user) {
      throw new Error("Unauthorized");
    }

    return {
      customerId: user.email, // Use email as customer ID
      customerData: {
        name: user.name,
        email: user.email,
      },
    };
  },
});

