// Supabase Edge Function: run-job
// Purpose: Pick the next queued job, process with Gemini, upload images to Storage, and mark as done.
// Auth: expects Authorization: Bearer <WEBHOOK_SECRET>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL_ID = "gemini-2.5-flash-image-preview"; // supports image generation with inlineData

async function toBase64FromUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch frame: ${resp.status}`);
  const ab = await resp.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function extractBase64FromDataUrl(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

async function normalizeFrames(frames: string[], max = 3): Promise<string[]> {
  const pick = frames.slice(0, max);
  const out: string[] = [];
  for (const f of pick) {
    if (!f) continue;
    if (f.startsWith("data:")) out.push(extractBase64FromDataUrl(f));
    else if (/^https?:\/\//i.test(f)) out.push(await toBase64FromUrl(f));
    else out.push(f); // assume already base64
  }
  return out;
}

async function generateImagesREST(
  apiKey: string,
  prompt: string,
  frames: string[],
  layoutImage?: string,
  count: number = 4,
): Promise<string[]> {
  const images: string[] = [];

  const normFrames = await normalizeFrames(frames, 3);
  const normLayout = layoutImage
    ? (layoutImage.startsWith("data:")
        ? extractBase64FromDataUrl(layoutImage)
        : (/^https?:\/\//i.test(layoutImage) ? await toBase64FromUrl(layoutImage) : layoutImage))
    : undefined;

  const parts: any[] = [
    { text: String(prompt) },
    ...normFrames.map((b64) => ({ inlineData: { data: b64, mimeType: "image/png" } })),
    ...(normLayout ? [{ inlineData: { data: normLayout, mimeType: "image/png" } }] : []),
  ];

  for (let i = 0; i < count; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }] }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const partsOut = data?.candidates?.[0]?.content?.parts ?? [];
    for (const part of partsOut) {
      const dataB64 = part?.inlineData?.data;
      if (typeof dataB64 === "string" && dataB64.length > 0) images.push(dataB64);
    }
  }

  return images;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binStr = atob(b64);
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${Deno.env.get("WEBHOOK_SECRET")}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("PROJECT_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // 1) Pick the next queued job
    const { data: job, error: fetchErr } = await supabase
      .from("jobs")
      .select("id, prompt, frames, layout_image, variants")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!job) {
      return new Response(JSON.stringify({ message: "No queued jobs" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2) Mark as processing (best-effort guard against races)
    const { error: updateErr } = await supabase
      .from("jobs")
      .update({ status: "processing" })
      .eq("id", job.id)
      .eq("status", "queued");

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_API_KEY") ?? Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      await supabase.from("jobs").update({ status: "error", error: "Missing GOOGLE_API_KEY/GEMINI_API_KEY" }).eq("id", job.id);
      return new Response(JSON.stringify({ error: "Missing GOOGLE_API_KEY/GEMINI_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const count = Math.max(1, Math.min(Number(job.variants) || 4, 8));
      const images = await generateImagesREST(apiKey, job.prompt, job.frames ?? [], job.layout_image ?? undefined, count);

      // 3) Upload to Storage (bucket: thumbnails)
      const bucket = "thumbnails"; // create this bucket and make it public
      const publicUrls: string[] = [];

      for (let i = 0; i < images.length; i++) {
        const bytes = base64ToUint8Array(images[i]);
        const path = `${job.id}/${i + 1}.png`;
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(path, bytes, { contentType: "image/png", upsert: true });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        if (pub?.publicUrl) publicUrls.push(pub.publicUrl);
      }

      // 4) Update job status
      await supabase
        .from("jobs")
        .update({ status: "done", result_urls: publicUrls })
        .eq("id", job.id);

      return new Response(JSON.stringify({ processed: job.id, count: publicUrls.length }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      await supabase
        .from("jobs")
        .update({ status: "error", error: err instanceof Error ? err.message : String(err) })
        .eq("id", job.id);
      return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

