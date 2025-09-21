export const runtime = "edge";

import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL_ID = "gemini-2.5-pro";
const RAPIDAPI_HOST = "io-youtube-transcriptor.p.rapidapi.com";
const MAX_TRANSCRIPT_CHARACTERS = 8000;

interface GenerateVideoContentRequest {
  youtubeUrl?: string;
}

interface GeminiContentResult {
  title: string;
  description: string;
}

interface TranscriptEntry {
  text?: string;
  offset?: number;
}

function extractVideoId(input: string): string | null {
  if (!input) return null;

  const trimmed = input.trim();

  // Direct video ID support
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();

    if (host.includes("youtu.be")) {
      const segments = url.pathname.split("/").filter(Boolean);
      const id = segments[0];
      return id || null;
    }

    if (host.includes("youtube.com")) {
      const vParam = url.searchParams.get("v");
      if (vParam) {
        return vParam;
      }

      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length > 0) {
        if (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "live") {
          return segments[1] || null;
        }
      }
    }
  } catch {
    // Ignore URL parsing errors and fall through
  }

  return null;
}

function processTranscript(data: any): string {
  if (!data || data.success === false) {
    throw new Error("Transcript API returned an error");
  }

  const entries: TranscriptEntry[] | undefined = data?.results?.transcript;
  if (!Array.isArray(entries)) {
    throw new Error("Transcript data missing or malformed");
  }

  const processedLines = entries
    .filter((item): item is Required<Pick<TranscriptEntry, "text">> & TranscriptEntry => typeof item?.text === "string" && item.text.trim().length > 0)
    .map((item) => {
      const offsetSeconds = typeof item.offset === "number" ? Math.max(0, item.offset) : 0;
      const minutes = Math.floor(offsetSeconds / 60);
      const seconds = Math.floor(offsetSeconds % 60);
      const timestamp = `${minutes}:${seconds.toString().padStart(2, "0")}`;
      return `[${timestamp}] ${item.text?.trim() ?? ""}`.trim();
    })
    .filter((line) => line.length > 0);

  if (processedLines.length === 0) {
    throw new Error("Transcript response did not contain text");
  }

  const transcript = processedLines.join("\n");
  if (transcript.length <= MAX_TRANSCRIPT_CHARACTERS) {
    return transcript;
  }

  return `${transcript.slice(0, MAX_TRANSCRIPT_CHARACTERS)}\n...`; // Truncate with ellipsis
}

function buildPrompt(videoId: string, transcript: string): string {
  return `You are assisting with YouTube content optimization. Analyze the provided transcript to craft an engaging, SEO-friendly title and description.

Video ID: ${videoId}
Transcript with timestamps:
${transcript}

Requirements:
1. Title under 60 characters that drives clicks without clickbait.
2. Description of 2-3 paragraphs summarizing the video, calling out key takeaways, audience, and a call-to-action.
3. Include 3-5 relevant hashtags at the end of the description.
4. Format the response as minified JSON with keys "title" and "description". Do not include any additional commentary or Markdown formatting.`;
}

function tryParseGeminiJson(content: string): GeminiContentResult | null {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed?.title === "string" && typeof parsed?.description === "string") {
      return {
        title: parsed.title.trim(),
        description: parsed.description.trim(),
      };
    }
  } catch {
    // Ignore parse errors and fall through
  }
  return null;
}

function parseGeminiResponse(raw: string): GeminiContentResult {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const candidates: string[] = [];

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }
  candidates.push(cleaned);

  for (const candidate of candidates) {
    const parsed = tryParseGeminiJson(candidate);
    if (parsed) {
      return parsed;
    }
  }

  throw new Error("Gemini response was not valid JSON");
}

function buildMockTranscript(videoId: string): string {
  return [`[0:00] Mock transcript generated for video ${videoId}.`,
    "[0:12] This content simulates a real transcript entry for testing.",
    "[0:24] Use the Playwright MCP tests to validate the UI without external APIs.",
  ].join("\n");
}

function buildMockContent(videoId: string): GeminiContentResult {
  return {
    title: `Sample optimization for ${videoId}`,
    description: [
      `This is a mocked description used while testing the video optimizer flow for video ${videoId}.`,
      "It demonstrates how the generated copy will be displayed in the interface, including keyword-rich messaging and a clear call to action.",
      "#mock #videoOptimizer #testing"
    ].join("\n\n"),
  };
}

function extractTextFromGemini(result: any): string | null {
  if (!result) {
    return null;
  }

  const responseText = typeof result?.response?.text === "function" ? result.response.text() : undefined;
  if (typeof responseText === "string" && responseText.trim().length > 0) {
    return responseText.trim();
  }

  const parts = result?.response?.candidates?.[0]?.content?.parts ?? result?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (typeof part?.text === "string" && part.text.trim().length > 0) {
        return part.text.trim();
      }
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as GenerateVideoContentRequest | null;

    const youtubeUrl = body?.youtubeUrl?.trim();
    if (!youtubeUrl) {
      return Response.json({ success: false, error: "Missing youtubeUrl" }, { status: 400 });
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return Response.json({ success: false, error: "Invalid YouTube URL or ID" }, { status: 400 });
    }

    if (process.env.MOCK_VIDEO_OPTIMIZER === "true") {
      const transcript = buildMockTranscript(videoId);
      const mockContent = buildMockContent(videoId);
      return Response.json({
        success: true,
        mock: true,
        videoId,
        transcript,
        generatedTitle: mockContent.title,
        description: mockContent.description,
      });
    }

    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      return Response.json({ success: false, error: "Missing RAPIDAPI_KEY" }, { status: 500 });
    }

    const transcriptUrl = new URL(`https://${RAPIDAPI_HOST}/`);
    // Use the original YouTube URL format that works with the API
    const fullYouTubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    transcriptUrl.searchParams.set("videoId", fullYouTubeUrl);
    transcriptUrl.searchParams.set("format", "json");
    transcriptUrl.searchParams.set("timestamp", "0");

    const transcriptResponse = await fetch(transcriptUrl.toString(), {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": rapidApiKey,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text().catch(() => "");
      throw new Error(`Transcript request failed (${transcriptResponse.status}): ${errorText}`);
    }

    const transcriptData = await transcriptResponse.json();
    const transcript = processTranscript(transcriptData);

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return Response.json({ success: false, error: "Missing GEMINI_API_KEY or GOOGLE_API_KEY" }, { status: 500 });
    }

    const genAI = new GoogleGenAI({ apiKey });
    const prompt = buildPrompt(videoId, transcript);
    const result = await genAI.models.generateContent({
      model: GEMINI_MODEL_ID,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = extractTextFromGemini(result);
    if (!text) {
      throw new Error("Gemini did not return any text content");
    }

    const { title, description } = parseGeminiResponse(text);

    return Response.json({
      success: true,
      videoId,
      transcript,
      generatedTitle: title,
      description,
    });
  } catch (error) {
    console.error("/api/generate-video-content error", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}

