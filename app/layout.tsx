import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "SiteRing AI";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — 24/7 AI Receptionist for UK Trades`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Never miss a £500 job while on the tools. SiteRing AI answers every call 24/7, captures job details, and alerts you instantly. Built for UK plumbers, electricians, builders & locksmiths.",
  keywords: [
    "AI receptionist",
    "UK trades",
    "plumber answering service",
    "electrician call answering",
    "virtual receptionist UK",
    "call forwarding",
  ],
  openGraph: {
    type: "website",
    title: `${APP_NAME} — 24/7 AI Receptionist for UK Trades`,
    description:
      "Every call answered in seconds. Every lead captured. £150/mo with 500 minutes included.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className="dark" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground",
          inter.variable,
        )}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
