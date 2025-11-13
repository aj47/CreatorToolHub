import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const homepageUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://creatortoolhub.com";
const homepageDescription =
  "Creator Tool Hub is the AI workspace for YouTube creators to generate thumbnails, titles, descriptions, and timestamps that rank.";
const homepageOgImage = `${homepageUrl}/favicon.png`;

export const metadata: Metadata = {
  title: "YouTube Thumbnail, Title & Timestamp Generator",
  description: homepageDescription,
  keywords: [
    "YouTube thumbnail generator",
    "YouTube title generator",
    "YouTube timestamp generator",
    "YouTube description generator",
    "AI YouTube tools",
    "YouTube SEO optimization",
  ],
  alternates: {
    canonical: homepageUrl,
  },
  openGraph: {
    type: "website",
    url: homepageUrl,
    title: "YouTube Thumbnail, Title & Timestamp Generator",
    description: homepageDescription,
    siteName: "Creator Tool Hub",
    images: [
      {
        url: homepageOgImage,
        width: 512,
        height: 512,
        alt: "Creator Tool Hub AI tools preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Thumbnail, Title & Timestamp Generator",
    description: homepageDescription,
    images: [homepageOgImage],
  },
};

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12">
      {/* Hero */}
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
            Generate YouTube thumbnails, titles & timestamps in minutes
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Creator Tool Hub helps YouTube creators ship eye-catching thumbnails, keyword-rich titles, and automatic
            timestamps that make every upload easier to discover.
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              AI-powered YouTube thumbnail generator tuned for higher CTR.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              YouTube title & description generator with keyword suggestions.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              Automatic YouTube timestamp generator built from your transcript.
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/thumbnails">
              <Button size="lg">Launch Thumbnail Generator</Button>
            </Link>
            <Link href="/video-seo">
              <Button size="lg" variant="secondary">
                Generate Titles & Timestamps
              </Button>
            </Link>
          </div>
        </div>
        <Card className="overflow-hidden">
          <div className="aspect-video">
            <iframe
              className="h-full w-full"
              src="https://www.youtube.com/embed/0flgKnOcLWQ"
              title="Creator Tool Hub demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </Card>
      </section>

      {/* Feature grid */}
      <section className="py-12" aria-label="Creator workflow tools">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">YouTube Thumbnail Generator</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Produce scroll-stopping thumbnail designs in just a few clicks.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                <li>Capture frames from your upload or import existing artwork.</li>
                <li>Apply high-performing layouts, fonts, and styles tailored to YouTube.</li>
                <li>Export 1280×720-ready images that stay within YouTube’s guidelines.</li>
              </ul>
              <div className="mt-4">
                <Link href="/thumbnails" className="text-sm font-medium text-primary hover:underline">
                  Create AI thumbnails →
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">YouTube Title & Description Generator</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Turn transcripts into keyword-rich titles, descriptions, and hashtags.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                <li>Generate multiple SEO-optimized YouTube titles under 60 characters.</li>
                <li>Write descriptions that weave in your target queries naturally.</li>
                <li>Copy titles, descriptions, and hashtags with a single click.</li>
              </ul>
              <div className="mt-4">
                <Link href="/video-seo" className="text-sm font-medium text-primary hover:underline">
                  Write titles & descriptions →
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">YouTube Timestamp Generator</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Automatically create accurate chapter markers that boost watch time.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                <li>Paste any public YouTube link and we fetch the transcript instantly.</li>
                <li>Convert offsets into MM:SS chapter labels that summarize each segment.</li>
                <li>Publish timestamps directly inside your YouTube description.</li>
              </ul>
              <div className="mt-4">
                <Link href="/video-seo#results" className="text-sm font-medium text-primary hover:underline">
                  Generate timestamps →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="py-12" aria-labelledby="roadmap-title">
        <Card>
          <CardHeader>
            <CardTitle id="roadmap-title" className="text-2xl">
              Ship faster today & see what’s next
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              We ship updates weekly so you stay ahead of YouTube’s algorithm.
            </p>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-6 border-l border-border pl-6">
              <li className="relative">
                <div className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  ✓
                </div>
                <div className="font-medium">
                  AI thumbnail generator
                  <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    Done
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload frames or images, iterate on styles, and export ready-to-upload thumbnails.
                </p>
              </li>
              <li className="relative">
                <div className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  ✓
                </div>
                <div className="font-medium">
                  Video SEO suite
                  <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    Done
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Generate YouTube titles, descriptions, hashtags, and timestamps from any transcript.
                </p>
              </li>
              <li className="relative">
                <div className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-foreground">
                  •
                </div>
                <div className="font-medium">
                  Thumbnail refinements
                  <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    Done
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Iterate with feedback prompts to dial in text, subjects, and styling without starting over.
                </p>
              </li>
              <li className="relative">
                <div className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-foreground">
                  •
                </div>
                <div className="font-medium">
                  Bulk channel optimizations
                  <span className="ml-2 rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                    Coming soon
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Batch-generate metadata, timestamps, and thumbnails across multiple uploads at once.
                </p>
              </li>
              <li className="relative">
                <div className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-foreground">
                  •
                </div>
                <div className="font-medium">
                  Suggest a feature
                  <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                    Your ideas
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tell us what would help you most.{' '}
                  <a
                    href="https://github.com/aj47/CreatorToolHub/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Submit on GitHub →
                  </a>
                </p>
              </li>
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-12" aria-labelledby="faq-title">
        <Card>
          <CardHeader>
            <CardTitle id="faq-title" className="text-2xl">
              FAQ: Creator Tool Hub for YouTube SEO
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <details className="rounded-md border p-4">
              <summary className="cursor-pointer font-medium">How does the YouTube timestamp generator work?</summary>
              <p className="mt-2 text-sm text-muted-foreground">
                We fetch the public transcript for your video, map each line to its offset, and return polished MM:SS chapter markers you can paste into your description.
              </p>
            </details>
            <details className="rounded-md border p-4">
              <summary className="cursor-pointer font-medium">Can I customize the AI thumbnail generator?</summary>
              <p className="mt-2 text-sm text-muted-foreground">
                Yes. Upload your own frames, reference images, color palettes, and prompts to fine-tune every thumbnail variation.
              </p>
            </details>
            <details className="rounded-md border p-4">
              <summary className="cursor-pointer font-medium">Do the generated titles follow YouTube best practices?</summary>
              <p className="mt-2 text-sm text-muted-foreground">
                Absolutely. We keep titles under 60 characters, include high-intent keywords, and surface multiple options so you can A/B test.
              </p>
            </details>
            <details className="rounded-md border p-4">
              <summary className="cursor-pointer font-medium">What does it cost to use the YouTube SEO tools?</summary>
              <p className="mt-2 text-sm text-muted-foreground">
                You can explore the workspace for free, then add affordable credits only when you need new thumbnail or metadata generations.
              </p>
            </details>
          </CardContent>
        </Card>
      </section>

      {/* Final CTA */}
      <section className="py-12" aria-labelledby="cta-title">
        <Card>
          <CardHeader className="space-y-2 text-center">
            <CardTitle id="cta-title" className="text-2xl">
              Ready to rank for more YouTube searches?
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Sign in to Creator Tool Hub and turn your transcript into thumbnails, titles, descriptions, and timestamps that convert.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-center gap-3">
            <Link href="/video-seo">
              <Button size="lg">Start generating titles & timestamps</Button>
            </Link>
            <Link href="/thumbnails">
              <Button size="lg" variant="secondary">
                Design thumbnails now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
