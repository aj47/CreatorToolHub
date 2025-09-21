import type { Metadata } from "next";

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://creatortoolhub.com").replace(/\/$/, "");
const canonicalUrl = `${baseUrl}/pricing`;
const description = "Compare Creator Tool Hub pricing, credits, and plans for generating YouTube thumbnails, titles, descriptions, and timestamps.";
const ogImage = `${baseUrl}/favicon.png`;

export const metadata: Metadata = {
  title: "Creator Tool Hub Pricing & Credits",
  description,
  keywords: [
    "Creator Tool Hub pricing",
    "YouTube SEO tool pricing",
    "YouTube thumbnail generator cost",
    "AI video title generator pricing",
    "YouTube timestamp generator credits",
    "Creator Tool Hub plans",
  ],
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    type: "website",
    url: canonicalUrl,
    title: "Creator Tool Hub Pricing & Credits",
    description,
    siteName: "Creator Tool Hub",
    images: [
      {
        url: ogImage,
        width: 512,
        height: 512,
        alt: "Creator Tool Hub pricing table",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Creator Tool Hub Pricing & Credits",
    description,
    images: [ogImage],
  },
};

