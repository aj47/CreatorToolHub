import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
        <header style={{ padding: "12px 16px", borderBottom: "1px solid #eee", display: "flex", gap: 12 }}>
          <a href="/" style={{ fontWeight: 600 }}>Creator Tool Hub</a>
          <nav style={{ display: "flex", gap: 12 }}>
            <a href="/thumbnails">Thumbnail Creator</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
