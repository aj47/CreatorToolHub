import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import AuthButton from "@/components/AuthButton";
import { AppProvider } from "@/lib/state/providers/AppProvider";
import { AppErrorBoundary } from "@/lib/errors/ErrorBoundary";

import { AutumnProvider } from "autumn-js/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Creator Tool Hub",
  description: "A hub of minimal, focused tools for creators",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const content = (
    <>
      <header className="nb-header">
        <Link href="/" className="nb-brand">Creator Tool Hub</Link>
        <nav className="nb-nav">
          <Link href="/thumbnails" className="nb-navlink nb-navlink--active">Thumbnail Creator</Link>

        </nav>
        <AuthButton />
      </header>
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
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AppErrorBoundary>
          <AppProvider>
            <AutumnProvider includeCredentials={true}>
              {content}
            </AutumnProvider>
          </AppProvider>
        </AppErrorBoundary>
      </body>
    </html>
  );
}
