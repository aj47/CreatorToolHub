"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { useCustomer } from "autumn-js/react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useUI } from "@/lib/state/providers/UIProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

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

  // UI notifications
  const { addNotification } = useUI();

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

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Video SEO Generated Successfully!',
        message: `Generated ${data.titles?.length || 0} titles, description, and ${data.timestamps?.length || 0} timestamps`,
        duration: 5000,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [youtubeUrl, isAuthed, loadingCustomer, credits, creditsRequired, addNotification]);

  const onSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    void handleGenerate();
  }, [canSubmit, handleGenerate]);

  const currentStep = loading ? 2 : result ? 3 : 1;

  return (
    <div className="bg-slate-50">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-12 pt-8 sm:px-6 lg:pb-16 lg:pt-10">
        <header className="mb-4 space-y-3 text-center md:mb-6 md:text-left">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Tool / Video SEO
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            YouTube title, description & timestamp generator
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Paste any YouTube link to turn transcripts into SEO-optimized titles, keyword-rich descriptions,
            clickable thumbnail ideas, and chapter timestamps.
          </p>
        </header>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqJsonLd }}
        />

        {/* Stepper */}
        <nav
          className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm backdrop-blur-sm md:flex-row md:items-center md:justify-between"
          aria-label="Video SEO steps"
        >
          <div className="flex flex-1 items-center gap-2">
            {[1, 2, 3].map((step) => {
              const label = step === 1 ? "Input" : step === 2 ? "Generate" : "Results";
              const description =
                step === 1
                  ? "Paste YouTube link"
                  : step === 2
                    ? "Fetch transcript & SEO"
                    : "Copy into YouTube Studio";
              const active = currentStep === step;
              const complete = currentStep > step;
              return (
                <div
                  key={step}
                  className={`flex flex-1 items-center gap-2 rounded-full border px-3 py-2 text-xs md:text-sm ${
                    active
                      ? "border-red-500 bg-red-50 text-red-700"
                      : complete
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-500"
                  }`}
                  aria-current={active ? "step" : undefined}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                      active || complete
                        ? "bg-red-600 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {step}
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="font-medium">{label}</span>
                    <span className="text-[10px] text-slate-500">{description}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 md:text-sm">
            {currentStep === 1 && "1. Input - add your YouTube URL."}
            {currentStep === 2 && "2. Generate - we fetch the transcript and SEO content."}
            {currentStep === 3 && "3. Results - copy titles, description, and timestamps."}
          </p>
        </nav>

        {/* Form + guidance */}
        <section className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="border-slate-200 bg-white/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Optimize your video SEO</CardTitle>
              <CardDescription>
                Turn any public YouTube link into titles, descriptions, timestamps, and thumbnail ideas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={onSubmit} data-testid="video-seo-form" className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="youtubeUrl"
                    className="block text-xs font-medium uppercase tracking-wide text-slate-500"
                  >
                    YouTube link or ID
                  </label>
                  <Input
                    id="youtubeUrl"
                    value={youtubeUrl}
                    onChange={(event) => setYoutubeUrl(event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                    disabled={loading}
                    data-testid="video-url-input"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {isAuthed ? (
                      !loadingCustomer ? (
                        <>
                          Credits required: {" "}
                          <span className="font-semibold text-slate-900">{creditsRequired}</span>.
                          {" "}
                          You have {" "}
                          <span className="font-semibold text-slate-900">{credits}</span>{" "}
                          credits.
                        </>
                      ) : (
                        "Loading your available credits..."
                      )
                    ) : (
                      "Sign in to track credits and save your SEO presets."
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    data-testid="generate-video-content-button"
                    className="min-w-[220px]"
                  >
                    {loading
                      ? "Generating..."
                      : authLoading
                        ? "Loading..."
                        : !isAuthed
                          ? "Generate title & description (Free after sign-up)"
                          : !loadingCustomer
                            ? `Generate title & description (uses ${creditsRequired} credit${creditsRequired === 1 ? "" : "s"})`
                            : "Generate title & description"}
                  </Button>
                </div>
              </form>

              {error && (
                <div
                  className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                  data-testid="video-seo-error"
                >
                  <p className="font-semibold">Something went wrong</p>
                  <p className="mt-1">{error}</p>
                </div>
              )}

              {loading && (
                <p className="text-xs text-slate-500">
                  Generating SEO contentthis can take up to a minute for longer videos.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed border-slate-200 bg-slate-50/80 shadow-sm">
            <CardContent className="space-y-3 py-4 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                What you&apos;ll get
              </p>
              <ul className="list-disc space-y-1 pl-4 text-xs">
                <li>5 title options under 60 characters.</li>
                <li>Keyword-rich description with inline timestamps.</li>
                <li>10 thumbnail ideas you can test on your channel.</li>
                <li>Formatted timestamps ready to paste into YouTube Studio.</li>
              </ul>
              <p className="text-xs text-slate-500">
                Pro tip: turn on {" "}
                <code className="rounded bg-slate-900/5 px-1 py-0.5 font-mono text-[10px]">
                  MOCK_VIDEO_SEO=true
                </code>{" "}
                in development to work without external APIs.
              </p>
            </CardContent>
          </Card>
        </section>

        {result && (
          <section className="mt-8 space-y-4">
            {result.mock && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p className="font-semibold">Mock data enabled</p>
                <p className="mt-1">
                  Set {" "}
                  <code className="rounded bg-amber-900/10 px-1 py-0.5 font-mono text-[11px]">
                    MOCK_VIDEO_SEO=true
                  </code>{" "}
                  locally to work without external API calls.
                </p>
              </div>
            )}

            <Card className="border-slate-200 bg-white/80 shadow-sm" data-testid="video-seo-result">
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">SEO-optimized content</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Titles, descriptions, timestamps, and thumbnail ideas generated from your video.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-emerald-500 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  ✓ Generated
                </span>
              </div>
              {/* Title Options */}
              <section className="mt-4 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Title options ({result.titles?.length || 0})
                    </h3>
                    {result.titles && result.titles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {result.titles.map((title, index) => {
                          const isSelected = selectedTitleIndex === index;
                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => setSelectedTitleIndex(index)}
                              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                                isSelected
                                  ? "border-red-500 bg-red-50 text-slate-900"
                                  : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                              }`}
                            >
                              <p className="font-medium">{title}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {title.length} characters
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyToClipboard(result.titles?.[selectedTitleIndex] || "", "title")}
                    disabled={!result.titles?.[selectedTitleIndex]}
                    aria-label="Copy selected title"
                    className="mt-2 w-full shrink-0 sm:mt-0 sm:w-auto"
                  >
                    {copied.title ? "Copied" : "Copy selected"}
                  </Button>
                </div>
              </section>

              {/* Description */}
              <section className="mt-6 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Description</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyToClipboard(result.description, "description")}
                    disabled={!result.description}
                    aria-label="Copy generated description"
                    className="mt-2 w-full shrink-0 sm:mt-0 sm:w-auto"
                  >
                    {copied.description ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div
                  className="whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-xs leading-relaxed text-slate-800"
                  data-testid="generated-description"
                >
                  {result.description}
                </div>
              </section>

              {timestamps.length > 0 && (
                <section className="mt-6 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Timestamps &amp; chapters ({timestamps.length})
                    </h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void copyToClipboard(timestamps.join("\n"), "timestamps")}
                      disabled={!timestamps.length}
                      aria-label="Copy generated timestamps"
                      className="mt-2 w-full shrink-0 sm:mt-0 sm:w-auto"
                    >
                      {copied.timestamps ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div
                    className="whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-xs leading-relaxed text-slate-800"
                    data-testid="generated-timestamps"
                  >
                    {timestamps.join("\n")}
                  </div>
                </section>
              )}

              {/* Thumbnail Ideas */}
              {thumbnailIdeas.length > 0 && (
                <section className="mt-6 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Thumbnail ideas ({thumbnailIdeas.length})
                    </h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void copyToClipboard(thumbnailIdeas.join("\n"), "thumbnailIdeas")}
                      disabled={!thumbnailIdeas.length}
                      aria-label="Copy all thumbnail ideas"
                      className="mt-2 w-full shrink-0 sm:mt-0 sm:w-auto"
                    >
                      {copied.thumbnailIdeas ? "Copied" : "Copy all"}
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {thumbnailIdeas.map((idea, index) => (
                      <div
                        key={index}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 shadow-sm"
                      >
                        <span className="mr-2 font-semibold text-red-600">#{index + 1}</span>
                        {idea}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Transcript (truncated)</h3>
                <div
                  className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-[11px] leading-relaxed text-slate-700"
                  data-testid="video-transcript"
                >
                  {result.transcript}
                </div>
              </section>

              <div className="text-[11px] text-slate-500">
                Video ID: <span className="font-mono text-slate-700">{result.videoId}</span>
              </div>
            </Card>
          </section>
        )}


        <section
          aria-labelledby="videoSeoFaq"
          className="mt-12 space-y-4"
        >
          <div className="text-center">
            <h2
              id="videoSeoFaq"
              className="text-2xl font-semibold tracking-tight text-slate-900"
            >
              Video SEO FAQ
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Answers to common questions about titles, descriptions, timestamps, and credits.
            </p>
          </div>

          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Frequently asked questions
              </CardTitle>
              <CardDescription>
                Helpful details about how the video SEO generator works.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {faqItems.map((item) => (
                  <details
                    key={item.question}
                    className="group rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900">
                      <span>{item.question}</span>
                      <span className="text-slate-400 transition-transform group-open:rotate-180">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

