export const runtime = "edge";

// This endpoint now enqueues a job in Supabase via an Edge Function and returns a jobId immediately.
// It avoids long-running requests on Cloudflare Pages.
export async function POST(req: Request) {
  try {
    const { prompt, frames = [], variants = 4, layoutImage } = await req.json();

    if (!prompt || !Array.isArray(frames) || frames.length === 0) {
      return Response.json(
        { error: "Missing prompt or frames" },
        { status: 400 }
      );
    }

    const enqueueUrlRaw = process.env.SUPABASE_ENQUEUE_URL || "";
    const enqueueUrl = enqueueUrlRaw.trim().replace(/^=/, "");
    const webhookSecret = (process.env.SUPABASE_WEBHOOK_SECRET || "").trim();

    if (!enqueueUrl || !webhookSecret) {
      return Response.json(
        { error: "Missing SUPABASE_ENQUEUE_URL or SUPABASE_WEBHOOK_SECRET" },
        { status: 500 }
      );
    }

    const cfTimeoutMs = 25_000; // keep this under Cloudflare's limits for safety
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort("timeout"), cfTimeoutMs);

    try {
      const resp = await fetch(enqueueUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Shared secret header expected by the Supabase Edge Function
          Authorization: `Bearer ${webhookSecret}`,
        },
        body: JSON.stringify({ prompt, frames, variants, layoutImage }),
        signal: ac.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        const text = await resp.text();
        return Response.json(
          { error: `Enqueue failed (${resp.status}): ${text}` },
          { status: 502 }
        );
      }

      const data = await resp.json();
      // Expected shape from the Supabase function: { jobId: string }
      if (!data?.jobId) {
        return Response.json(
          { error: "Malformed response from enqueue function" },
          { status: 502 }
        );
      }

      return Response.json({ jobId: data.jobId });
    } catch (e) {
      clearTimeout(timer);
      if ((e as any)?.name === "AbortError") {
        return Response.json(
          { error: "Timed out enqueuing job" },
          { status: 504 }
        );
      }
      throw e;
    }
  } catch (err: unknown) {
    console.error("/api/generate enqueue error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
