import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import AuthButton from "@/components/AuthButton";

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
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <header className="nb-header">
          <Link href="/" className="nb-brand">Creator Tool Hub</Link>
          <nav className="nb-nav">
            <Link href="/thumbnails" className="nb-navlink">Thumbnail Creator</Link>
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
      </body>
    </html>
  );
}
