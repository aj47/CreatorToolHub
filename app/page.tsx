import type { Metadata } from "next";

const homepageUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://creatortoolhub.com";
const homepageDescription = "Creator Tool Hub is the AI workspace for YouTube creators to generate thumbnails, titles, descriptions, and timestamps that rank.";
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
    <main className="nb-main">
      <section className="nb-hero">
        <div className="nb-hero-grid">
          <div>
            <h1 className="nb-hero-title">Generate YouTube thumbnails, titles & timestamps in minutes</h1>
            <p className="nb-hero-sub">
              Creator Tool Hub helps YouTube creators ship eye-catching thumbnails, keyword-rich titles, and automatic timestamps that make every upload easier to discover.
            </p>
            <ul className="nb-list" style={{ marginTop: 16 }}>
              <li>AI-powered YouTube thumbnail generator tuned for higher CTR.</li>
              <li>YouTube title & description generator with keyword suggestions.</li>
              <li>Automatic YouTube timestamp generator built from your transcript.</li>
            </ul>
            <div className="nb-hero-ctas">
              <a className="nb-btn nb-btn--accent" href="/thumbnails">Launch Thumbnail Generator</a>
              <a className="nb-btn" href="/video-seo">Generate Titles & Timestamps</a>
            </div>
          </div>
          <div className="nb-card nb-hero-preview">
            <div className="nb-thumb-demo">
              <span>Your AI-powered YouTube toolkit</span>
            </div>
          </div>
        </div>
      </section>

      <section className="nb-section" aria-label="Creator workflow tools">
        <div className="nb-card-grid">
          <article className="nb-card nb-card--feature">
            <h3 className="nb-feature-title">YouTube Thumbnail Generator</h3>
            <p>Produce scroll-stopping thumbnail designs in just a few clicks.</p>
            <ul className="nb-list">
              <li>Capture frames from your upload or import existing artwork.</li>
              <li>Apply high-performing layouts, fonts, and styles tailored to YouTube.</li>
              <li>Export 1280×720-ready images that stay within YouTube’s guidelines.</li>
            </ul>
            <a className="nb-card-cta" href="/thumbnails">
              <span>Create AI thumbnails</span>
              <span aria-hidden="true">→</span>
            </a>
          </article>

          <article className="nb-card nb-card--feature">
            <h3 className="nb-feature-title">YouTube Title & Description Generator</h3>
            <p>Turn transcripts into keyword-rich titles, descriptions, and hashtags.</p>
            <ul className="nb-list">
              <li>Generate multiple SEO-optimized YouTube titles under 60 characters.</li>
              <li>Write descriptions that weave in your target queries naturally.</li>
              <li>Copy titles, descriptions, and hashtags with a single click.</li>
            </ul>
            <a className="nb-card-cta" href="/video-seo">
              <span>Write titles & descriptions</span>
              <span aria-hidden="true">→</span>
            </a>
          </article>

          <article className="nb-card nb-card--feature">
            <h3 className="nb-feature-title">YouTube Timestamp Generator</h3>
            <p>Automatically create accurate chapter markers that boost watch time.</p>
            <ul className="nb-list">
              <li>Paste any public YouTube link and we fetch the transcript instantly.</li>
              <li>Convert offsets into MM:SS chapter labels that summarize each segment.</li>
              <li>Publish timestamps directly inside your YouTube description.</li>
            </ul>
            <a className="nb-card-cta" href="/video-seo#results">
              <span>Generate timestamps</span>
              <span aria-hidden="true">→</span>
            </a>
          </article>
        </div>
      </section>

      <section id="roadmap" className="nb-section" aria-labelledby="roadmap-title">
        <div className="nb-card" style={{ display: "grid", gap: 20 }}>
          <div>
            <h2 id="roadmap-title" className="nb-feature-title">Ship faster today & see what’s next</h2>
            <p className="nb-muted">We ship updates weekly so you stay ahead of YouTube’s algorithm.</p>
          </div>
          <ol className="nb-timeline" style={{ marginTop: 10 }}>
            <li className="nb-tl-item nb-tl--done">
              <div className="nb-tl-node" />
              <div className="nb-tl-content">
                <div className="nb-feature-title">AI thumbnail generator <span className="nb-badge nb-badge--done">Done</span></div>
                <p>Upload frames or images, iterate on styles, and export ready-to-upload thumbnails.</p>
              </div>
            </li>
            <li className="nb-tl-item nb-tl--done">
              <div className="nb-tl-node" />
              <div className="nb-tl-content">
                <div className="nb-feature-title">Video SEO suite <span className="nb-badge nb-badge--done">Done</span></div>
                <p>Generate YouTube titles, descriptions, hashtags, and timestamps from any transcript.</p>
              </div>
            </li>
            <li className="nb-tl-item nb-tl--done">
              <div className="nb-tl-node" />
              <div className="nb-tl-content">
                <div className="nb-feature-title">Thumbnail refinements <span className="nb-badge nb-badge--done">Done</span></div>
                <p>Iterate with feedback prompts to dial in text, subjects, and styling without starting over.</p>
              </div>
            </li>
            <li className="nb-tl-item">
              <div className="nb-tl-node" />
              <div className="nb-tl-content">
                <div className="nb-feature-title">Bulk channel optimizations <span className="nb-badge">Coming soon</span></div>
                <p>Batch-generate metadata, timestamps, and thumbnails across multiple uploads at once.</p>
              </div>
            </li>
            <li className="nb-tl-item">
              <div className="nb-tl-node" />
              <div className="nb-tl-content">
                <div className="nb-feature-title">Suggest a feature <span className="nb-badge">Your ideas</span></div>
                <p>Tell us what would help you most. <a href="https://github.com/aj47/CreatorToolHub/issues" target="_blank" rel="noopener noreferrer">Submit on GitHub →</a></p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section id="faq" className="nb-section" aria-labelledby="faq-title">
        <div className="nb-faq-card">
          <h2 id="faq-title" className="nb-feature-title">FAQ: Creator Tool Hub for YouTube SEO</h2>
          <details className="nb-faq-item">
            <summary>How does the YouTube timestamp generator work?</summary>
            <p>We fetch the public transcript for your video, map each line to its offset, and return polished MM:SS chapter markers you can paste into your description.</p>
          </details>
          <details className="nb-faq-item">
            <summary>Can I customize the AI thumbnail generator?</summary>
            <p>Yes. Upload your own frames, reference images, color palettes, and prompts to fine-tune every thumbnail variation.</p>
          </details>
          <details className="nb-faq-item">
            <summary>Do the generated titles follow YouTube best practices?</summary>
            <p>Absolutely. We keep titles under 60 characters, include high-intent keywords, and surface multiple options so you can A/B test.</p>
          </details>
          <details className="nb-faq-item">
            <summary>What does it cost to use the YouTube SEO tools?</summary>
            <p>You can explore the workspace for free, then add affordable credits only when you need new thumbnail or metadata generations.</p>
          </details>
        </div>
      </section>

      <section className="nb-section" aria-labelledby="cta-title">
        <div className="nb-card" style={{ display: "grid", gap: 16, textAlign: "center" }}>
          <h2 id="cta-title" className="nb-feature-title">Ready to rank for more YouTube searches?</h2>
          <p className="nb-muted">Sign in to Creator Tool Hub and turn your transcript into thumbnails, titles, descriptions, and timestamps that convert.</p>
          <div className="nb-hero-ctas" style={{ justifyContent: "center" }}>
            <a className="nb-btn nb-btn--accent" href="/video-seo">Start generating titles & timestamps</a>
            <a className="nb-btn" href="/thumbnails">Design thumbnails now</a>
          </div>
        </div>
      </section>
    </main>
  );
}

