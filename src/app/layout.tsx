import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeScript } from "@/components/layout/theme-script";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ascend Business Mastery",
    template: "%s · Ascend Business Mastery",
  },
  description:
    "The private operating school for building Ascend — an AI automation and web development agency.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#191a1f" },
    { media: "(prefers-color-scheme: light)", color: "#fdfdfe" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only-focusable absolute top-3 left-3 z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
