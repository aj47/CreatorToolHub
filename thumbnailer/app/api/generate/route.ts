import { GoogleGenAI, Modality } from "@google/genai";

// Initialize with API key from environment
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "",
});
const MODEL_ID = "gemini-2.5-flash-image-preview";

type InlineDataPart = { inlineData?: { data?: string; mimeType?: string } };
type Candidate = { content?: { parts?: InlineDataPart[] } };

type GenerateParams = Parameters<typeof ai.models.generateContent>[0];

export async function POST(req: Request) {
  try {
    const { prompt, frames = [], variants = 4, layoutImage } = await req.json();

    if (!prompt || !Array.isArray(frames) || frames.length === 0) {
      return Response.json(
        { error: "Missing prompt or frames" },
        { status: 400 }
      );
    }

    const inputParts: GenerateParams["contents"] = [
      { text: String(prompt) },
      ...frames.slice(0, 3).map((b64: string) => ({
        inlineData: { data: b64, mimeType: "image/png" },
      })),
      ...(layoutImage ? [{ inlineData: { data: String(layoutImage), mimeType: "image/png" } }] : []),
    ] as unknown as GenerateParams["contents"];

    const count = Math.max(1, Math.min(Number(variants) || 4, 8));
    const allImages: string[] = [];

    for (let i = 0; i < count; i++) {
      const res = await ai.models.generateContent({
        model: MODEL_ID,
        contents: inputParts,
        config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
      });

      const cand = (res.candidates?.[0] ?? undefined) as Candidate | undefined;
      const parts = cand?.content?.parts ?? [];
      for (const part of parts) {
        const data = part.inlineData?.data;
        if (typeof data === "string" && data.length > 0) {
          allImages.push(data);
        }
      }
    }

    return Response.json({ images: allImages });
  } catch (err: unknown) {
    console.error("/api/generate error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

