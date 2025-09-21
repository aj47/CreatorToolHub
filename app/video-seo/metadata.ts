import type { Metadata } from "next";

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://creatortoolhub.com").replace(/\/$/, "");
const canonicalUrl = `${baseUrl}/video-seo`;
const description = "Creator Tool Hub's YouTube video SEO generator produces keyword-rich titles, descriptions, timestamps, and thumbnail ideas from any YouTube link.";
const ogImage = `${baseUrl}/favicon.png`;

export const metadata: Metadata = {
  title: "YouTube Title, Description & Timestamp Generator",
  description,
  keywords: [
    "YouTube timestamp generator",
    "YouTube title generator",
    "YouTube description generator",
    "YouTube SEO tools",
    "automatic video chapters",
    "YouTube metadata generator",
  ],
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    type: "website",
    url: canonicalUrl,
    title: "YouTube Title, Description & Timestamp Generator",
    description,
    siteName: "Creator Tool Hub",
    images: [
      {
        url: ogImage,
        width: 512,
        height: 512,
        alt: "Creator Tool Hub Video SEO workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Title, Description & Timestamp Generator",
    description,
    images: [ogImage],
  },
};

