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

  // Auth and credits
  const { user, loading: authLoading } = useAuth();
  const { customer, isLoading: customerLoading } = useCustomer({ errorOnNotFound: false });
  const isDevelopment = process.env.NODE_ENV === 'development';

  const credits = useMemo(() => {
    if (isDevelopment) return 999;
    if (!customer?.features) return 0;
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
      console.error("Clipboard copy failed", copyError);
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
      console.error("Video SEO request failed", requestError);
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
        <div className={styles.hero}>
          <span className={styles.newBadge}>AI YouTube SEO</span>
          <h1 className={styles.title}>YouTube title, description & timestamp generator</h1>
          <p className={styles.subtitle}>
            Paste any YouTube link to turn transcripts into SEO-optimized titles, keyword-rich descriptions, clickable thumbnail ideas, and chapter timestamps.
          </p>
          <ul className={styles.heroHighlights}>
            <li>Generate multiple YouTube titles and descriptions tuned for search intent.</li>
            <li>Automatic timestamp generator formats MM:SS chapters for your video description.</li>
            <li>Get thumbnail concepts and references to boost click-through rate.</li>
          </ul>
        </div>

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

        <section className={styles.featuresSection} aria-labelledby="videoSeoBenefits">
          <h2 id="videoSeoBenefits" className={styles.featureHeading}>Why creators use our YouTube title & timestamp generator</h2>
          <p className={styles.featureIntro}>
            Creator Tool Hub combines AI copywriting and precise timestamps so your videos rank for intent-driven searches like &ldquo;YouTube timestamp generator&rdquo; and &ldquo;YouTube title generator&rdquo;.
          </p>
          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Keyword-rich titles & descriptions</h3>
              <p>Ship multiple title variations and keyword-dense descriptions pulled directly from your transcript.</p>
              <ul className={styles.featureList}>
                <li>Deliver 5 SEO-optimized YouTube titles under 60 characters.</li>
                <li>Auto-generate descriptions with hashtags, CTAs, and relevant search terms.</li>
                <li>Copy titles, descriptions, and hashtags into YouTube Studio instantly.</li>
              </ul>
            </article>
            <article className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Automatic timestamp generator</h3>
              <p>Create chapter markers that highlight every key talking point.</p>
              <ul className={styles.featureList}>
                <li>Convert transcripts into precise MM:SS chapters and topic labels.</li>
                <li>Keep viewers engaged with clear navigation across your video.</li>
                <li>Reuse timestamp lists for your description, blog posts, or show notes.</li>
              </ul>
            </article>
            <article className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Thumbnail & creative direction</h3>
              <p>Pair metadata with visual ideas to increase click-through rate.</p>
              <ul className={styles.featureList}>
                <li>Receive 10 thumbnail concepts aligned with your topic and hook.</li>
                <li>Send thumbnail prompts straight to the Creator Tool Hub generator.</li>
                <li>Share references with collaborators so every asset stays on brand.</li>
              </ul>
            </article>
          </div>
        </section>

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

              {result.timestamps && result.timestamps.length > 0 && (
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Timestamps & Chapters ({result.timestamps.length})</h3>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      onClick={() => void copyToClipboard(result.timestamps.join('\n'), "timestamps")}
                      disabled={!result.timestamps.length}
                      aria-label="Copy generated timestamps"
                    >
                      {copied.timestamps ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div
                    className={styles.contentBox}
                    data-testid="generated-timestamps"
                  >
                    {result.timestamps.join('\n')}
                  </div>
                </section>
              )}

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

