export interface Env {
  GEMINI_API_KEY: string;
  MODEL_ID?: string; // optional override via Wrangler vars
}

const DEFAULT_MODEL = "gemini-2.5-flash-image-preview";

async function callGeminiGenerate(apiKey: string, model: string, parts: any[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini error ${resp.status}: ${text}`);
  }
  return resp.json();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "POST" || url.pathname !== "/api/generate") {
      return new Response("Not Found", { status: 404 });
    }

    try {
      const { prompt, frames = [], framesMime, variants, layoutImage } = await request.json();

      if (!prompt || !Array.isArray(frames) || frames.length === 0) {
        return Response.json({ error: "Missing prompt or frames" }, { status: 400 });
      }

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
      }
      const model = env.MODEL_ID || DEFAULT_MODEL;
      const imageMime = (typeof framesMime === "string" && framesMime.startsWith("image/")) ? framesMime : "image/png";

      // Build request parts once: up to 3 frames + text prompt
      const reqParts: any[] = [];
      for (const b64 of (frames as string[]).slice(0, 3)) {
        if (typeof b64 === "string" && b64.length > 0) {
          reqParts.push({ inlineData: { mimeType: imageMime, data: b64 } });
        }
      }
      reqParts.push({ text: prompt });
      // layoutImage is not used currently; left for future extension

      const count = Math.max(1, Math.min(Number(variants) || 1, 8));
      const CONCURRENCY = 3; // generous but bounded

      const imagesAll: string[] = [];
      for (let i = 0; i < count; i += CONCURRENCY) {
        const batchSize = Math.min(CONCURRENCY, count - i);
        const batch = Array.from({ length: batchSize }, async () => {
          const json = await callGeminiGenerate(apiKey, model, reqParts);
          const parts = json?.candidates?.[0]?.content?.parts ?? [];
          const imgs: string[] = [];
          for (const p of parts) {
            const b64 = p?.inlineData?.data as string | undefined;
            if (typeof b64 === "string" && b64.length > 0) imgs.push(b64);
          }
          return imgs;
        });
        const settled = await Promise.allSettled(batch);
        for (const s of settled) {
          if (s.status === "fulfilled") imagesAll.push(...s.value);
        }
      }

      if (imagesAll.length === 0) {
        return Response.json({ error: "Failed to generate any images" }, { status: 500 });
      }

      const dataUrls = imagesAll.map((b64) => `data:image/png;base64,${b64}`);
      return Response.json({ images: dataUrls });
    } catch (err: any) {
      return Response.json({ error: err?.message || "Unknown error" }, { status: 500 });
    }
  },
};

