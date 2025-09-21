export const runtime = "edge";

import { GoogleGenAI } from "@google/genai";
import { getUser } from "@/lib/auth";
import { Autumn } from "autumn-js";

const GEMINI_MODEL_ID = "gemini-2.5-pro";
const RAPIDAPI_HOST = "io-youtube-transcriptor.p.rapidapi.com";
const MAX_TRANSCRIPT_CHARACTERS = 8000;

interface GenerateVideoContentRequest {
  youtubeUrl?: string;
}

interface GeminiContentResult {
  titles: string[];
  description: string;
  thumbnailIdeas: string[];
  timestamps?: string[];
  references?: string[];
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
  return `Your task is to generate YouTube titles, description, and thumbnail ideas for this video given the transcript.

Video ID: ${videoId}
Transcript with timestamps:
${transcript}

Requirements:
1. Generate 5 different title options (each under 60 characters) that follow best practices and will generate the most clickthrough
2. The description should have lots of keywords for SEO but also be concise and make sense
3. Any keywords hard to add to the description can be added as hashtags below
4. The description should contain timestamps in format MM:SS - <topic> (start with MM:SS until 1hr in). Timestamps should be no more than 6 words in length and be of the topic that is talked about at the time
5. Include placeholder links to references mentioned in the video
6. Generate 10 thumbnail ideas that follow best practices and will generate the most clickthrough
7. Format the response as valid JSON with this exact structure:

{
  "titles": ["title1", "title2", "title3", "title4", "title5"],
  "description": "full description with timestamps and hashtags",
  "thumbnailIdeas": ["idea1", "idea2", "idea3", "idea4", "idea5", "idea6", "idea7", "idea8", "idea9", "idea10"],
  "timestamps": ["MM:SS - topic", "MM:SS - topic", ...],
  "references": ["reference1", "reference2", ...]
}

Do not include any additional commentary or Markdown formatting. Return only valid JSON.`;
}

function tryParseGeminiJson(content: string): GeminiContentResult | null {
  try {
    const parsed = JSON.parse(content);

    // Check for new structured format
    if (Array.isArray(parsed?.titles) && typeof parsed?.description === "string" && Array.isArray(parsed?.thumbnailIdeas)) {
      return {
        titles: parsed.titles.map((t: any) => String(t).trim()).filter(Boolean),
        description: parsed.description.trim(),
        thumbnailIdeas: parsed.thumbnailIdeas.map((t: any) => String(t).trim()).filter(Boolean),
        timestamps: Array.isArray(parsed.timestamps) ? parsed.timestamps.map((t: any) => String(t).trim()).filter(Boolean) : undefined,
        references: Array.isArray(parsed.references) ? parsed.references.map((r: any) => String(r).trim()).filter(Boolean) : undefined,
      };
    }

    // Fallback to old format for backward compatibility
    if (typeof parsed?.title === "string" && typeof parsed?.description === "string") {
      return {
        titles: [parsed.title.trim()],
        description: parsed.description.trim(),
        thumbnailIdeas: [],
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
    titles: [
      `Amazing AI Tool That Changes Everything - ${videoId}`,
      `This Open-Source App Fixes The Biggest Problem`,
      `10-Second Solution? You Won't Believe This`,
      `Why Everyone's Talking About This New Tool`,
      `The Future of AI is Here (And It's Free!)`
    ],
    description: [
      `This is a comprehensive mocked description for testing the video SEO flow for video ${videoId}. It demonstrates how the generated copy will be displayed in the interface, including keyword-rich messaging, timestamps, and a clear call to action.`,
      "",
      "00:15 - Introduction to the problem",
      "01:30 - Demonstration of the solution",
      "02:45 - Key features overview",
      "04:20 - Live coding example",
      "06:10 - Community collaboration",
      "",
      "References:",
      "- GitHub Repository: [Link]",
      "- Documentation: [Link]",
      "- Community Discord: [Link]",
      "",
      "#mock #videoSEO #testing #AI #opensource"
    ].join("\n"),
    thumbnailIdeas: [
      "Split screen: frustrated developer vs happy developer using the tool",
      "Large text overlay '10 SECONDS' with shocked face reaction",
      "Before/after comparison of messy vs clean workflow",
      "Developer pointing at screen with bright arrows and highlights",
      "Question mark thumbnail: 'The Tool Everyone's Using?'",
      "Red arrow pointing to specific UI element with 'GAME CHANGER' text",
      "Side-by-side code comparison with VS Code screenshots",
      "Person with hands on head (frustrated) next to solution preview",
      "Bright neon text 'OPEN SOURCE' with GitHub logo prominent",
      "Multiple app windows with big X marks vs single clean interface"
    ],
    timestamps: [
      "00:15 - Problem introduction",
      "01:30 - Solution demo",
      "02:45 - Feature overview",
      "04:20 - Live example",
      "06:10 - Community info"
    ],
    references: [
      "GitHub Repository",
      "Official Documentation",
      "Community Discord"
    ]
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
    // Authentication check
    let user = getUser(req);
    if (!user && process.env.NODE_ENV === 'development') {
      // Use mock user in development
      user = {
        email: 'dev@example.com',
        name: 'Dev User',
        picture: '',
      };
    }
    if (!user) {
      return Response.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as GenerateVideoContentRequest | null;

    const youtubeUrl = body?.youtubeUrl?.trim();
    if (!youtubeUrl) {
      return Response.json({ success: false, error: "Missing youtubeUrl" }, { status: 400 });
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return Response.json({ success: false, error: "Invalid YouTube URL or ID" }, { status: 400 });
    }

    // Autumn credit check: Video SEO costs 1 credit
    const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";
    const deriveCustomerId = (email: string) => {
      const raw = email.toLowerCase();
      const cleaned = raw
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-_]+/, "")
        .replace(/[-_]+$/, "");
      return ("u-" + cleaned).slice(0, 40);
    };
    const customer_id = deriveCustomerId(user.email);

    const secretKey = process.env.AUTUMN_SECRET_KEY;
    const autumnEnabled = !!secretKey && process.env.NODE_ENV === 'production';
    const creditsRequired = 1; // Video SEO costs 1 credit

    let allowed = true;
    let autumn: Autumn | null = null;

    if (autumnEnabled) {
      autumn = new Autumn({ secretKey: secretKey as string });
      try {
        const checkRes = await autumn.check({ customer_id, feature_id: FEATURE_ID, required_balance: creditsRequired });
        allowed = !!checkRes?.data?.allowed;
      } catch (e) {
        return Response.json(
          { success: false, error: "Billing service unavailable. Please try again.", code: "billing_unavailable" },
          { status: 503 }
        );
      }
      if (!allowed) {
        return Response.json(
          { success: false, error: "Insufficient credits", code: "insufficient_credits", feature_id: FEATURE_ID, required: creditsRequired },
          { status: 402 }
        );
      }
    }

    if (process.env.MOCK_VIDEO_SEO === "true") {
      const transcript = buildMockTranscript(videoId);
      const mockContent = buildMockContent(videoId);
      return Response.json({
        success: true,
        mock: true,
        videoId,
        transcript,
        titles: mockContent.titles,
        description: mockContent.description,
        thumbnailIdeas: mockContent.thumbnailIdeas,
        timestamps: mockContent.timestamps,
        references: mockContent.references,
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

    const content = parseGeminiResponse(text);

    // Track credit usage after successful generation
    if (autumn) {
      try {
        await autumn.track({ customer_id, feature_id: FEATURE_ID, value: creditsRequired });
      } catch (e) {
        console.warn("Autumn track failed; continuing without failing request", e);
      }
    }

    return Response.json({
      success: true,
      videoId,
      transcript,
      titles: content.titles,
      description: content.description,
      thumbnailIdeas: content.thumbnailIdeas,
      timestamps: content.timestamps,
      references: content.references,
    });
  } catch (error) {
    console.error("/api/generate-video-content error", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}

