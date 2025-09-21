"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import styles from "./page.module.css";

interface GenerationResult {
  success: boolean;
  videoId: string;
  transcript: string;
  titles: string[];
  description: string;
  thumbnailIdeas: string[];
  timestamps?: string[];
  references?: string[];
  mock?: boolean;
}

type CopyTarget = "title" | "description" | "thumbnailIdeas";

export default function VideoOptimizerPage() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [copied, setCopied] = useState<Record<CopyTarget, boolean>>({ title: false, description: false, thumbnailIdeas: false });
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0);

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
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.hero}>
          <span className={styles.newBadge}>New</span>
          <h1 className={styles.title}>Video Optimizer</h1>
          <p className={styles.subtitle}>
            Paste any YouTube link and get an optimized title and description crafted from the transcript in seconds.
          </p>
        </div>

        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Optimize your video metadata</h2>

          <form onSubmit={onSubmit} data-testid="video-optimizer-form">
            <div className={styles.formGroup}>
              <label className={styles.label}>
                YouTube link or ID
              </label>
              <input
                className={styles.input}
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                disabled={loading}
                data-testid="video-url-input"
              />
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className={styles.button}
              data-testid="generate-video-content-button"
            >
              {loading ? "Generating..." : "Generate title & description"}
            </button>
          </form>

          <div className={styles.infoCallout}>
            <strong>Pro tip:</strong> We fetch the full transcript via the official IO YouTube Transcriptor API, then craft metadata using Gemini 2.5 Pro.
          </div>
        </div>

        {error && (
          <div className={styles.errorCard} data-testid="video-optimizer-error">
            <p className={styles.errorTitle}>Something went wrong</p>
            <p className={styles.errorMessage}>{error}</p>
          </div>
        )}

        {result && (
          <div className={styles.resultsSection}>
            {result.mock && (
              <div className={styles.mockWarning}>
                <p className={styles.mockTitle}>Mock data enabled</p>
                <p className={styles.mockMessage}>Set <code className={styles.mockCode}>MOCK_VIDEO_OPTIMIZER=true</code> locally to work without external API calls.</p>
              </div>
            )}

            <div className={styles.resultCard} data-testid="video-optimizer-result">
              <h2 className={styles.resultTitle}>Optimized content</h2>
              {/* Title Options */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div style={{ flex: 1 }}>
                    <h3 className={styles.sectionTitle}>Title Options ({result.titles?.length || 0})</h3>
                    {result.titles && result.titles.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        {result.titles.map((title, index) => (
                          <div
                            key={index}
                            className={`${styles.titleOption} ${
                              selectedTitleIndex === index ? styles.titleOptionSelected : ''
                            }`}
                            onClick={() => setSelectedTitleIndex(index)}
                          >
                            <p className={styles.titleText}>{title}</p>
                            <p className={styles.titleMeta}>
                              {title.length} characters
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    onClick={() => void copyToClipboard(result.titles?.[selectedTitleIndex] || "", "title")}
                    disabled={!result.titles?.[selectedTitleIndex]}
                    aria-label="Copy selected title"
                  >
                    {copied.title ? "Copied" : "Copy Selected"}
                  </button>
                </div>
              </section>

              {/* Description */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Description</h3>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    onClick={() => void copyToClipboard(result.description, "description")}
                    disabled={!result.description}
                    aria-label="Copy generated description"
                  >
                    {copied.description ? "Copied" : "Copy"}
                  </button>
                </div>
                <div
                  className={styles.contentBox}
                  data-testid="generated-description"
                >
                  {result.description}
                </div>
              </section>

              {/* Thumbnail Ideas */}
              {result.thumbnailIdeas && result.thumbnailIdeas.length > 0 && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Thumbnail Ideas ({result.thumbnailIdeas.length})</h3>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      onClick={() => void copyToClipboard(result.thumbnailIdeas.join('\n'), "thumbnailIdeas")}
                      disabled={!result.thumbnailIdeas.length}
                      aria-label="Copy all thumbnail ideas"
                    >
                      {copied.thumbnailIdeas ? "Copied" : "Copy All"}
                    </button>
                  </div>
                  <div className={styles.thumbnailGrid}>
                    {result.thumbnailIdeas.map((idea, index) => (
                      <div
                        key={index}
                        className={styles.thumbnailIdea}
                      >
                        <span className={styles.thumbnailNumber}>#{index + 1}</span>{idea}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Transcript (truncated)</h3>
                <div
                  className={styles.transcriptBox}
                  data-testid="video-transcript"
                >
                  {result.transcript}
                </div>
              </section>

              <div className={styles.videoMeta}>
                Video ID: <span>{result.videoId}</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

