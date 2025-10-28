export const runtime = "edge";

import { getUser } from "@/lib/auth";

// In development mode, return mock data
const isDevelopment = process.env.NODE_ENV === 'development';

const AUTUMN_API_BASE = "https://api.useautumn.com/v1"; // Fixed: added /v1
const AUTUMN_SECRET_KEY = process.env.AUTUMN_SECRET_KEY;

// Helper to derive customer ID from email
function deriveCustomerId(email: string): string {
  const raw = email.toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+/, "")
    .replace(/[-_]+$/, "");
  return ("u-" + cleaned).slice(0, 40);
}

// Helper to call Autumn API
async function callAutumnAPI(path: string, options: RequestInit = {}) {
  if (!AUTUMN_SECRET_KEY) {
    throw new Error("AUTUMN_SECRET_KEY not configured");
  }

  const url = `${AUTUMN_API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "Authorization": `Bearer ${AUTUMN_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Autumn API error: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace("/api/autumn", "");

    // In development, return mock data
    if (isDevelopment) {
      if (path === "/products") {
        return new Response(JSON.stringify({
          list: [
            { id: "creator", name: "Creator Plan", items: [] },
            { id: "pro", name: "Pro Plan", items: [] },
          ]
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (path === "/customers") {
        return new Response(JSON.stringify({
          id: "dev-user",
          balance: 999,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Handle /products endpoint
    if (path === "/products") {
      const products = await callAutumnAPI("/products");
      return new Response(JSON.stringify(products), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle /customers endpoint - requires authentication
    if (path === "/customers") {
      const user = getUser(request);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const customerId = deriveCustomerId(user.email);
      const customer = await callAutumnAPI(`/customers/${customerId}`);

      return new Response(JSON.stringify(customer), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Default: proxy to Autumn API
    const data = await callAutumnAPI(path);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Autumn GET error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace("/api/autumn", "");

    // In development, return mock data
    if (isDevelopment) {
      if (path === "/customers") {
        return new Response(JSON.stringify({
          id: "dev-user",
          balance: 999,
          created: true,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Handle /customers endpoint - create or update customer
    if (path === "/customers") {
      const user = getUser(request);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const customerId = deriveCustomerId(user.email);
      const body = await request.json();

      const customer = await callAutumnAPI(`/customers/${customerId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...body,
          email: user.email,
          name: user.name,
        }),
      });

      return new Response(JSON.stringify(customer), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Default: proxy POST to Autumn API
    const body = await request.json();
    const data = await callAutumnAPI(path, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Autumn POST error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

