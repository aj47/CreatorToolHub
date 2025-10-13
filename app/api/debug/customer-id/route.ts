export const runtime = "edge";

import { getUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = getUser(request);

  if (!user) {
    return Response.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // Derive customer ID using the same logic as the Autumn handler
  const raw = user.email.toLowerCase();
  const cleaned = raw
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+/, "")
    .replace(/[-_]+$/, "");
  const customerId = ("u-" + cleaned).slice(0, 40);

  return Response.json({
    email: user.email,
    name: user.name,
    derivedCustomerId: customerId,
    derivationSteps: {
      raw: user.email,
      lowercase: raw,
      replacedNonAlphanumeric: raw.replace(/[^a-z0-9_-]/g, "-"),
      collapsedDashes: raw.replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-"),
      trimmedDashes: raw
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-_]+/, "")
        .replace(/[-_]+$/, ""),
      withPrefix: "u-" + cleaned,
      final: customerId,
    },
  });
}

