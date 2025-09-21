"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface GenerationResult {
  success: boolean;
  videoId: string;
  transcript: string;
  generatedTitle: string;
  description: string;
  mock?: boolean;
}

type CopyTarget = "title" | "description";

export default function VideoOptimizerPage() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [copied, setCopied] = useState<Record<CopyTarget, boolean>>({ title: false, description: false });

  const canSubmit = useMemo(() => youtubeUrl.trim().length > 0 && !loading, [loading, youtubeUrl]);

  const resetCopiedState = useCallback((target: CopyTarget) => {
    setTimeout(() => {
      setCopied((prev) => ({ ...prev, [target]: false }));
    }, 2000);
  }, []);

  const copyToClipboard = useCallback(async (text: string, target: CopyTarget) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied((prev) => ({ ...prev, [target]: true }));
      resetCopiedState(target);
    } catch (copyError) {
      console.error("Clipboard copy failed", copyError);
      setError("Unable to copy to clipboard. Check browser permissions and try again.");
    }
  }, [resetCopiedState]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/generate-video-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ youtubeUrl }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        const message = data?.error || `Request failed with status ${response.status}`;
        throw new Error(message);
      }

      setResult(data as GenerationResult);
    } catch (requestError) {
      console.error("Video optimizer request failed", requestError);
      setError(requestError instanceof Error ? requestError.message : "Unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [youtubeUrl]);

  const onSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    void handleGenerate();
  }, [canSubmit, handleGenerate]);

  return (
    <div className="container mx-auto max-w-5xl px-4 pb-16 pt-12">
      <div className="mb-8 space-y-3 text-center">
        <span className="nb-pill">New</span>
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">Video Optimizer</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
          Paste any YouTube link and get an optimized title and description crafted from the transcript in seconds.
        </p>
      </div>

      <Card className="nb-card">
        <CardHeader className="pb-4">
          <CardTitle className="nb-text text-xl font-semibold">Optimize your video metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={onSubmit} className="space-y-4" data-testid="video-optimizer-form">
            <label className="flex flex-col gap-2 text-sm font-medium">
              YouTube link or ID
              <Input
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                disabled={loading}
                data-testid="video-url-input"
              />
            </label>
            <Button type="submit" disabled={!canSubmit} data-testid="generate-video-content-button">
              {loading ? "Generating..." : "Generate title & description"}
            </Button>
          </form>

          <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Pro tip: We fetch the full transcript via the official IO YouTube Transcriptor API, then craft metadata using Gemini 2.5 Pro.
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mt-6">
          <div className="nb-card border-destructive bg-red-100/80 text-destructive" data-testid="video-optimizer-error">
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          {result.mock && (
            <div className="nb-card border-amber-500 bg-amber-100/80 text-amber-900">
              <p className="text-sm font-medium">Mock data enabled</p>
              <p className="text-xs">Set <code>MOCK_VIDEO_OPTIMIZER=true</code> locally to work without external API calls.</p>
            </div>
          )}

          <Card className="nb-card" data-testid="video-optimizer-result">
            <CardHeader className="pb-4">
              <CardTitle className="nb-text text-xl font-semibold">Optimized content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold">Title</h2>
                    <p className="whitespace-pre-line text-lg font-medium" data-testid="generated-title">
                      {result.generatedTitle}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyToClipboard(result.generatedTitle, "title")}
                    disabled={!result.generatedTitle}
                    aria-label="Copy generated title"
                  >
                    {copied.title ? "Copied" : "Copy"}
                  </Button>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <h2 className="text-base font-semibold">Description</h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyToClipboard(result.description, "description")}
                    disabled={!result.description}
                    aria-label="Copy generated description"
                  >
                    {copied.description ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre
                  className="nb-card whitespace-pre-wrap break-words bg-background p-4 text-sm text-foreground"
                  data-testid="generated-description"
                >
                  {result.description}
                </pre>
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-semibold">Transcript (truncated)</h2>
                <pre
                  className="nb-card max-h-64 overflow-y-auto whitespace-pre-wrap break-words bg-background p-4 text-xs text-muted-foreground"
                  data-testid="video-transcript"
                >
                  {result.transcript}
                </pre>
              </section>

              <div className="text-xs text-muted-foreground">
                Video ID: <span className="font-mono">{result.videoId}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

