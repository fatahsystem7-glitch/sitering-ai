import Link from "next/link";
import { ArrowRight, PhoneCall } from "lucide-react";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { Solution } from "@/components/landing/solution";
import { Services } from "@/components/landing/services";
import { DemoCall } from "@/components/landing/demo-call";
import { HowItWorks } from "@/components/landing/how-it-works";
import { OnboardingFunnel } from "@/components/landing/onboarding-funnel";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { BadgeCheck } from "lucide-react";
import { getDemoPhoneNumber, telHref } from "@/lib/demo-phone";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const demoNumber = await getDemoPhoneNumber();
  const demoTel = telHref(demoNumber);

  return (
    <div id="top" className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* 1. Direct-response headline + subheadline */}
        <Hero demoNumber={demoNumber} demoTel={demoTel} />
        {/* 2. The Problem — missed calls = lost money */}
        <Problem />
        {/* 3. The Solution — 24/7 AI receptionist */}
        <Solution />
        {/* 4. Core value proposition — what you get */}
        <Services />
        {/* 5. Live Test Call demonstration */}
        <DemoCall demoNumber={demoNumber} demoTel={demoTel} />
        {/* 6. How it works — 3-step setup */}
        <HowItWorks />
        {/* 7. Public onboarding funnel — multi-step lead intake */}
        <section id="get-started" className="relative overflow-hidden py-16 md:py-24">
          <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[110px]" />
          <div className="container relative grid items-start gap-12 lg:grid-cols-2">
            <div className="lg:sticky lg:top-24">
              <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
                Free setup · Cancel anytime
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Get your trade online in minutes
              </h2>
              <p className="mt-4 max-w-md text-muted-foreground">
                Answer a few quick questions and we&apos;ll start your build and
                reserve a local number. It takes about two minutes.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  ["No upfront cost", "We build first — you go live when you're happy."],
                  ["Keep your leads", "Every call and message captured automatically."],
                  ["One dashboard", "Calls, transcripts and booked jobs in one place."],
                ].map(([title, body]) => (
                  <li key={title} className="flex gap-3">
                    <BadgeCheck size={20} className="mt-0.5 shrink-0 text-emerald-400" />
                    <span className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{title}</span>{" "}
                      — {body}
                    </span>
                  </li>
                ))}
              </ul>
              <blockquote className="mt-8 rounded-2xl border border-border bg-card/60 p-5 text-sm">
                <p className="italic text-muted-foreground">
                  “Set up in a week. I&apos;ve booked four extra boiler jobs this
                  month just from the missed-call texts.”
                </p>
                <footer className="mt-3 font-semibold">
                  Dave S. — Gas engineer, Bradford
                </footer>
              </blockquote>
            </div>
            <OnboardingFunnel />
          </div>
        </section>
        {/* 8. Pricing + direct buy */}
        <Pricing />
        {/* 9. FAQ & Guarantees */}
        <Faq />

        {/* Final CTA */}
        <section className="container py-16 md:py-24">
          <div className="card-glow relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/10 to-transparent p-10 text-center md:p-16">
            <div className="bg-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
                Your next £500 job is ringing right now.{" "}
                <span className="text-gradient">Answer it.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Call the live demo and hear it for yourself — or get SiteRing AI
                working for your business today.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <a href={demoTel}>
                    <PhoneCall size={18} /> Call {demoNumber}
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/signup">
                    Get SiteRing AI <ArrowRight size={18} />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
