"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { useCustomer } from "autumn-js/react";
import { useAuth } from "@/lib/auth/AuthProvider";
import styles from "./page.module.css";

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

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

type CopyTarget = "title" | "description" | "thumbnailIdeas" | "timestamps";

const faqItems: { question: string; answer: string }[] = [
  {
    question: "How does the YouTube timestamp generator work?",
    answer: "Paste any public YouTube URL and Creator Tool Hub fetches the transcript, converts offsets into MM:SS chapters, and formats them for your description.",
  },
  {
    question: "Will the YouTube title generator follow best practices?",
    answer: "Yes. Titles stay under 60 characters, include high-intent keywords from the transcript, and you can copy the strongest option with one click.",
  },
  {
    question: "Can I tailor the description and hashtags for my channel?",
    answer: "Absolutely. Edit the generated copy inline, keep the structured timestamps, and add the hashtags or links your audience needs before publishing.",
  },
  {
    question: "Do I need my own API keys or transcripts?",
    answer: "No. Creator Tool Hub handles transcript retrieval and AI generation—you just sign in, spend credits, and ship optimized metadata.",
  },
];

export default function VideoSEOPage() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [copied, setCopied] = useState<Record<CopyTarget, boolean>>({ title: false, description: false, thumbnailIdeas: false, timestamps: false });
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0);

  const timestamps = result?.timestamps ?? [];
  const thumbnailIdeas = result?.thumbnailIdeas ?? [];


  // Auth and credits
  const { user, loading: authLoading } = useAuth();
  const { customer, isLoading: customerLoading } = useCustomer({ errorOnNotFound: false });
  const isDevelopment = process.env.NODE_ENV === 'development';

  const credits = useMemo(() => {
    if (isDevelopment) return 999;
    if (!customer) return 0;

    // Handle flat balance structure (from Autumn API)
    const customerAny = customer as any;
    if (typeof customerAny.balance === "number") return customerAny.balance;

    // Handle nested features structure (expected by autumn-js)
    if (customer.features) {
      const feature = customer.features[FEATURE_ID as string] as {
        balance?: number;
        included_usage?: number;
        usage?: number;
      } | undefined;
      if (!feature) return 0;
      if (typeof feature.balance === "number") return feature.balance;
      if (typeof feature.included_usage === "number" && typeof feature.usage === "number") {
        return Math.max(0, (feature.included_usage ?? 0) - (feature.usage ?? 0));
      }
    }
    return 0;
  }, [customer, isDevelopment]);

  const isAuthed = !!user;
  const loadingCustomer = customerLoading && !isDevelopment;
  const creditsRequired = 1; // Video SEO costs 1 credit

  const canSubmit = useMemo(() => {
    if (!youtubeUrl.trim().length || loading || authLoading) return false;
    if (!isAuthed) return true; // Allow submission to show auth requirement
    if (loadingCustomer) return false; // Wait for customer data
    return credits >= creditsRequired;
  }, [youtubeUrl, loading, authLoading, isAuthed, loadingCustomer, credits, creditsRequired]);


  const faqJsonLd = useMemo(
    () =>
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }),
    []
  );

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
      setError("Unable to copy to clipboard. Check browser permissions and try again.");
    }
  }, [resetCopiedState]);

  const handleGenerate = useCallback(async () => {
    // Check auth requirement
    if (!isAuthed) {
      setError("Please sign in to generate video SEO content.");
      return;
    }

    // Check credits
    if (!loadingCustomer && credits < creditsRequired) {
      setError(`You need ${creditsRequired} credit to generate video SEO content. You have ${credits}.`);
      return;
    }

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
      setError(requestError instanceof Error ? requestError.message : "Unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [youtubeUrl, isAuthed, loadingCustomer, credits, creditsRequired]);

  const onSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    void handleGenerate();
  }, [canSubmit, handleGenerate]);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.hero}>
          <span className={styles.newBadge}>AI YouTube SEO</span>
          <h1 className={styles.title}>YouTube title, description & timestamp generator</h1>
          <p className={styles.subtitle}>
            Paste any YouTube link to turn transcripts into SEO-optimized titles, keyword-rich descriptions, clickable thumbnail ideas, and chapter timestamps.
          </p>
        </header>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqJsonLd }}
        />


        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Optimize your video SEO</h2>

          <form onSubmit={onSubmit} data-testid="video-seo-form">
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
            <div className={styles.buttonContainer}>
              <button
                type="submit"
                disabled={!canSubmit}
                className={styles.button}
                data-testid="generate-video-content-button"
              >
                {loading
                  ? "Generating..."
                  : authLoading

                    ? "Loading..."
                    : !isAuthed
                      ? "Generate title & description (Free after sign-up)"
                      : (!loadingCustomer
                          ? `Generate title & description (uses ${creditsRequired} credit${creditsRequired === 1 ? '' : 's'})`
                          : "Generate title & description")}
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className={styles.errorCard} data-testid="video-seo-error">
            <p className={styles.errorTitle}>Something went wrong</p>
            <p className={styles.errorMessage}>{error}</p>
          </div>
        )}

        {result && (
          <div className={styles.resultsSection}>
            {result.mock && (
              <div className={styles.mockWarning}>
                <p className={styles.mockTitle}>Mock data enabled</p>
                <p className={styles.mockMessage}>Set <code className={styles.mockCode}>MOCK_VIDEO_SEO=true</code> locally to work without external API calls.</p>
              </div>
            )}

            <div className={styles.resultCard} data-testid="video-seo-result">
              <h2 className={styles.resultTitle}>SEO-optimized content</h2>
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

              {timestamps.length > 0 && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Timestamps & Chapters ({timestamps.length})</h3>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      onClick={() => void copyToClipboard(timestamps.join('\n'), "timestamps")}
                      disabled={!timestamps.length}
                      aria-label="Copy generated timestamps"
                    >
                      {copied.timestamps ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div
                    className={styles.contentBox}
                    data-testid="generated-timestamps"
                  >
                    {timestamps.join('\n')}
                  </div>
                </section>
              )}

              {/* Thumbnail Ideas */}
              {thumbnailIdeas.length > 0 && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Thumbnail Ideas ({thumbnailIdeas.length})</h3>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      onClick={() => void copyToClipboard(thumbnailIdeas.join('\n'), "thumbnailIdeas")}
                      disabled={!thumbnailIdeas.length}
                      aria-label="Copy all thumbnail ideas"
                    >
                      {copied.thumbnailIdeas ? "Copied" : "Copy All"}
                    </button>
                  </div>
                  <div className={styles.thumbnailGrid}>
                    {thumbnailIdeas.map((idea, index) => (
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


        <section className={styles.faqSection} aria-labelledby="videoSeoFaq">
          <div className={styles.faqCard}>
            <h2 id="videoSeoFaq" className={styles.featureHeading}>Video SEO FAQ</h2>
            {faqItems.map((item) => (
              <details key={item.question} className={styles.faqItem}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

