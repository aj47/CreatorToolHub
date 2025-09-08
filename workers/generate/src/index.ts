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
    body: JSON.stringify({
      contents: [{ parts }],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    console.error(`Gemini API error: ${resp.status} ${resp.statusText}`, text.substring(0, 1000));
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
          console.log("Gemini response:", JSON.stringify(json, null, 2).substring(0, 2000));
          const cand = json?.candidates?.[0];
          const parts = cand?.content?.parts ?? [];
          const imgs: string[] = [];

          // Look for inlineData in parts (this is where Gemini puts generated images)
          for (const p of parts) {
            if (p?.inlineData?.data && p?.inlineData?.mimeType) {
              const { data, mimeType } = p.inlineData;
              // Convert to data URL format
              const dataUrl = `data:${mimeType};base64,${data}`;
              imgs.push(dataUrl);
            }
          }

          if (imgs.length === 0) {
            // Log helpful diagnostics
            const safety = cand?.safetyRatings || cand?.safetyRatingsV2;
            const finish = cand?.finishReason;
            const firstPart = Array.isArray(parts) && parts[0] ? Object.keys(parts[0]) : [];
            console.error("Gemini returned no images", {
              model,
              finish,
              partsCount: Array.isArray(parts) ? parts.length : 0,
              firstPart,
              safety,
              promptLen: (typeof prompt === 'string' ? prompt.length : 0),
              framesCount: Array.isArray(frames) ? frames.length : 0,
              imageMime,
            });
          }
          return imgs;
        });
        const settled = await Promise.allSettled(batch);
        for (const s of settled) {
          if (s.status === "fulfilled") imagesAll.push(...s.value);
        }
      }

      if (imagesAll.length === 0) {
        console.error("No images generated in final aggregation", {
          count,
          imageMime,
          framesLen: Array.isArray(frames) ? frames.length : 0,
          promptLen: typeof prompt === 'string' ? prompt.length : 0,
        });
        return Response.json({ error: "Failed to generate any images" }, { status: 500 });
      }

      const dataUrls = imagesAll.map((b64) => `data:image/png;base64,${b64}`);
      return Response.json({ images: dataUrls });
    } catch (err: any) {
      return Response.json({ error: err?.message || "Unknown error" }, { status: 500 });
    }
  },
};

