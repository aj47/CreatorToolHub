export const runtime = "edge";

import { GoogleGenAI } from "@google/genai";
import { getUser } from "@/lib/auth";

const GEMINI_MODEL_ID = "gemini-2.5-flash";

interface SuggestRefineRequest {
  thumbnailUrl: string;
  originalPrompt: string;
  templateId: string;
}

interface SuggestRefineResponse {
  success: boolean;
  suggestions?: string[];
  error?: string;
}

function extractTextFromGemini(result: any): string | null {
  const candidates = result?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return null;
  }
  const textPart = parts.find((p: any) => typeof p?.text === "string");
  return textPart?.text ?? null;
}

function parseSuggestions(text: string): string[] {
  try {
    // Try to parse as JSON first
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.suggestions)) {
        return parsed.suggestions.slice(0, 3);
      }
    }
    
    // Fallback: try to extract array directly
    const arrayMatch = cleaned.match(/\[(.*)\]/s);
    if (arrayMatch) {
      const parsed = JSON.parse(`[${arrayMatch[1]}]`);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 3);
      }
    }
  } catch (e) {
    // If JSON parsing fails, fall back to line-based parsing
  }
  
  // Fallback: parse as numbered list
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  const suggestions: string[] = [];
  for (const line of lines) {
    // Match patterns like "1. ", "1) ", "- ", etc.
    const match = line.match(/^(?:\d+[\.\)]\s*|[-*]\s*)(.+)$/);
    if (match && match[1]) {
      suggestions.push(match[1].trim());
      if (suggestions.length >= 3) break;
    }
  }
  
  return suggestions.slice(0, 3);
}

export async function POST(req: Request) {
  try {
    // Get user (optional for development)
    let user = getUser(req);
    if (!user && process.env.NODE_ENV === 'development') {
      user = {
        email: 'dev@example.com',
        name: 'Dev User',
        picture: '',
      };
    }
    
    const requestData: SuggestRefineRequest = await req.json();
    const { thumbnailUrl, originalPrompt, templateId } = requestData;
    
    if (!thumbnailUrl || !originalPrompt) {
      return Response.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return Response.json(
        { success: false, error: "Missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }
    
    const genAI = new GoogleGenAI({ apiKey });
    
    const prompt = `You are a YouTube thumbnail optimization expert. Analyze this thumbnail and suggest 3 specific, actionable refinements that would improve its click-through rate.

Original prompt used to generate this thumbnail:
${originalPrompt}

Template ID: ${templateId}

Provide exactly 3 concise refinement suggestions (each 5-10 words) that a user could apply to improve this thumbnail. Focus on:
- Text clarity and readability
- Color contrast and visual impact
- Composition and focal points
- Emotional appeal
- Mobile viewing optimization

Return your response as a JSON object with a "suggestions" array containing exactly 3 strings.

Example format:
{
  "suggestions": [
    "Make text larger and bolder",
    "Increase contrast between subject and background",
    "Add more vibrant colors to catch attention"
  ]
}`;
    
    const result = await genAI.models.generateContent({
      model: GEMINI_MODEL_ID,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    
    const text = extractTextFromGemini(result);
    if (!text) {
      throw new Error("Gemini did not return any text content");
    }
    
    const suggestions = parseSuggestions(text);
    
    if (suggestions.length === 0) {
      throw new Error("Failed to parse suggestions from Gemini response");
    }
    
    const response: SuggestRefineResponse = {
      success: true,
      suggestions,
    };
    
    return Response.json(response);
  } catch (error) {
    console.error("Suggest refinements error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate suggestions",
      },
      { status: 500 }
    );
  }
}

