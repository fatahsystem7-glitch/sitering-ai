import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, PhoneCall } from "lucide-react";
import { SignupWizard } from "@/components/onboarding/signup-wizard";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Set up your SiteRing AI receptionist — business details, ID and proof of address for Telnyx number verification.",
};

const BENEFITS: [string, string][] = [
  ["Free setup", "We build and configure everything — you go live when you're happy."],
  ["Your own UK number", "Verified with Telnyx and forwarded from your existing line."],
  ["One dashboard", "Call logs, message transcripts and settings in a single place."],
  ["Documents stay private", "Stored encrypted, used only for carrier verification."],
];

export default function OnboardingPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[110px]" />

      <header className="relative border-b border-border/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <PhoneCall size={18} />
            </span>
            <span className="text-lg font-bold tracking-tight">
              SiteRing <span className="text-emerald-400">AI</span>
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Log in
          </Link>
        </div>
      </header>

      <main className="container relative grid items-start gap-12 py-12 lg:grid-cols-2 lg:py-16">
        <div className="lg:sticky lg:top-16">
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Account creation · Telnyx verification
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Get your AI receptionist answering in days, not weeks
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Five short steps. You&apos;ll finish with a unique Client ID — that
            single ID is how you log into your dashboard, no passwords to
            remember.
          </p>
          <ul className="mt-8 space-y-4">
            {BENEFITS.map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <BadgeCheck size={20} className="mt-0.5 shrink-0 text-emerald-400" />
                <span className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{title}</span> —{" "}
                  {body}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <SignupWizard />
      </main>
    </div>
  );
}
