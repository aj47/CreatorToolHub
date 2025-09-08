// Supabase Edge Function: process-generate
// Purpose: Enqueue a thumbnail generation job and return a jobId immediately.
// Auth: expects Authorization: Bearer <WEBHOOK_SECRET>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${Deno.env.get("WEBHOOK_SECRET")}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { prompt, frames = [], variants = 4, layoutImage } = await req.json();
    if (!prompt || !Array.isArray(frames) || frames.length === 0) {
      return new Response(JSON.stringify({ error: "Missing prompt or frames" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("PROJECT_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // Insert job as queued
    const { data, error } = await supabase
      .from("jobs")
      .insert({ prompt, frames, layout_image: layoutImage ?? null, variants, status: "queued" })
      .select("id")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Optional immediate runner trigger (fire-and-forget)
    try {
      const projectHost = new URL(Deno.env.get("PROJECT_URL")!).host; // e.g., fcbymd....supabase.co
      const functionsHost = projectHost.replace(".supabase.co", ".functions.supabase.co");
      const runUrl = `https://${functionsHost}/run-job`;
      fetch(runUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("WEBHOOK_SECRET")}` },
      }).catch(() => {});
    } catch (_) {}

    return new Response(JSON.stringify({ jobId: data.id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

