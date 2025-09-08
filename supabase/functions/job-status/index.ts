// Supabase Edge Function: job-status
// Purpose: Return status and results for a given job id.
// Auth: expects Authorization: Bearer <WEBHOOK_SECRET>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${Deno.env.get("WEBHOOK_SECRET")}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    const supabase = createClient(
      Deno.env.get("PROJECT_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("jobs")
      .select("status, result_urls, error")
      .eq("id", id)
      .single();

    if (error) return new Response(error.message, { status: 404 });

    return new Response(
      JSON.stringify({ status: data.status, resultUrls: data.result_urls ?? [], error: data.error ?? null }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

