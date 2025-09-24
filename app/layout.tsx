import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppHeader from "@/components/AppHeader";
import { AppProvider } from "@/lib/state/providers/AppProvider";
import { AppErrorBoundary } from "@/lib/errors/ErrorBoundary";
import { AuthProvider } from "@/lib/auth/AuthProvider";

import { AutumnProvider } from "autumn-js/react";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://creatortoolhub.com";
const defaultDescription = "AI-powered tools for YouTube creators to generate thumbnails, titles, timestamps, and metadata in minutes.";
const defaultOgImage = `${siteUrl}/favicon.png`;
const defaultKeywords = [
  "YouTube thumbnail generator",
  "YouTube timestamp generator",
  "YouTube title generator",
  "YouTube description generator",
  "YouTube SEO tools",
  "timestamp generator for YouTube",
  "AI video metadata",
  "Creator Tool Hub",
];

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Creator Tool Hub",
  url: siteUrl,
  logo: defaultOgImage,
  sameAs: [
    "https://github.com/aj47/CreatorToolHub",
    "https://techfren.net",
  ],
};


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Creator Tool Hub | AI Tools for YouTube Creators",
    template: "%s | Creator Tool Hub",
  },
  description: defaultDescription,
  keywords: defaultKeywords,
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Creator Tool Hub | AI Tools for YouTube Creators",
    description: defaultDescription,
    siteName: "Creator Tool Hub",
    images: [
      {
        url: defaultOgImage,
        width: 512,
        height: 512,
        alt: "Creator Tool Hub icon",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Creator Tool Hub | AI Tools for YouTube Creators",
    description: defaultDescription,
    images: [defaultOgImage],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32", type: "image/x-icon" },
      { url: "/favicon.png", sizes: "200x200", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const content = (
    <>
      <AppHeader />
      {children}
      <footer className="nb-footer">
        <span>Open source on </span>
        <a href="https://github.com/aj47/CreatorToolHub" target="_blank" rel="noopener noreferrer">GitHub</a>
        <span> • Made with love by </span>
        <a href="https://techfren.net" target="_blank" rel="noopener noreferrer">techfren</a>
      </footer>
    </>
  );

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AppErrorBoundary>
          <AuthProvider>
            <AppProvider>
              <AutumnProvider includeCredentials={true}>
                {content}
              </AutumnProvider>
            </AppProvider>
          </AuthProvider>
        </AppErrorBoundary>
      </body>
    </html>
  );
}
