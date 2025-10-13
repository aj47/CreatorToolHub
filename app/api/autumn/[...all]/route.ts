export const runtime = "edge";

import { getUser } from "@/lib/auth";
import { Autumn } from "autumn-js";

// In development mode, disable Autumn entirely
const isDevelopment = process.env.NODE_ENV === 'development';

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

function deriveCustomerId(email: string): string {
  const raw = email.toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+/, "")
    .replace(/[-_]+$/, "");
  return ("u-" + cleaned).slice(0, 40);
}

export async function GET(request: Request) {
  if (isDevelopment) {
    return new Response('Not Found', { status: 404 });
  }

  const user = getUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const customerId = deriveCustomerId(user.email);
  const secretKey = process.env.AUTUMN_SECRET_KEY;

  if (!secretKey) {
    return new Response(JSON.stringify({ error: "Billing service not configured" }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const autumn = new Autumn({ secretKey });
    const checkRes = await autumn.check({ customer_id: customerId, feature_id: FEATURE_ID });

    return new Response(
      JSON.stringify({
        id: customerId,
        balance: checkRes?.data?.balance || 0,
        allowed: checkRes?.data?.allowed || false,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    console.error("Autumn GET error:", e);
    return new Response(JSON.stringify({ error: "Billing service error" }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(request: Request) {
  if (isDevelopment) {
    return new Response('Not Found', { status: 404 });
  }

  const user = getUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const customerId = deriveCustomerId(user.email);
  const secretKey = process.env.AUTUMN_SECRET_KEY;

  if (!secretKey) {
    return new Response(JSON.stringify({ error: "Billing service not configured" }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const autumn = new Autumn({ secretKey });

    // Fetch balance for the customer
    const checkRes = await autumn.check({ customer_id: customerId, feature_id: FEATURE_ID });

    return new Response(
      JSON.stringify({
        id: customerId,
        created: true,
        balance: checkRes?.data?.balance || 0,
        allowed: checkRes?.data?.allowed || false,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    console.error("Autumn POST error:", e);
    return new Response(JSON.stringify({ error: "Billing service error" }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

