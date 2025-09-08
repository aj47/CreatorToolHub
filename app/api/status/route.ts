export const runtime = "edge";

// GET /api/status?id=<uuid>
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }

    const statusUrlRaw = process.env.SUPABASE_STATUS_URL || "";
    const statusUrl = statusUrlRaw.trim().replace(/^=/, "");
    const webhookSecret = (process.env.SUPABASE_WEBHOOK_SECRET || "").trim();
    if (!statusUrl || !webhookSecret) {
      return Response.json(
        { error: "Missing SUPABASE_STATUS_URL or SUPABASE_WEBHOOK_SECRET" },
        { status: 500 }
      );
    }

    const cfTimeoutMs = 10_000;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort("timeout"), cfTimeoutMs);

    try {
      const resp = await fetch(`${statusUrl}?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${webhookSecret}` },
        signal: ac.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        const text = await resp.text();
        return Response.json(
          { error: `Status fetch failed (${resp.status}): ${text}` },
          { status: 502 }
        );
      }

      const data = await resp.json();
      // Expected shape: { status: "queued"|"processing"|"done"|"error", resultUrls?: string[], error?: string }
      return Response.json(data);
    } catch (e) {
      clearTimeout(timer);
      if ((e as any)?.name === "AbortError") {
        return Response.json(
          { error: "Timed out fetching status" },
          { status: 504 }
        );
      }
      throw e;
    }
  } catch (err: unknown) {
    console.error("/api/status error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

