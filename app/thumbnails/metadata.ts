import type { Metadata } from "next";

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://creatortoolhub.com").replace(/\/$/, "");
const canonicalUrl = `${baseUrl}/thumbnails`;
const description = "Creator Tool Hub's AI YouTube thumbnail generator captures frames, applies high-performing templates, and exports 1280x720 thumbnails ready for upload.";
const ogImage = `${baseUrl}/favicon.png`;

export const metadata: Metadata = {
  title: "AI YouTube Thumbnail Generator",
  description,
  keywords: [
    "YouTube thumbnail generator",
    "AI thumbnail maker",
    "create YouTube thumbnails",
    "YouTube thumbnail templates",
    "YouTube thumbnail design",
    "YouTube thumbnail ideas",
  ],
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    type: "website",
    url: canonicalUrl,
    title: "AI YouTube Thumbnail Generator",
    description,
    siteName: "Creator Tool Hub",
    images: [
      {
        url: ogImage,
        width: 512,
        height: 512,
        alt: "Creator Tool Hub thumbnail generator interface",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI YouTube Thumbnail Generator",
    description,
    images: [ogImage],
  },
};

