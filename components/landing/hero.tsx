import Link from "next/link";
import { ArrowRight, BadgeCheck, PhoneCall, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Backdrop flourishes */}
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />

      <div className="container relative flex flex-col items-center py-20 text-center md:py-28">
        <Badge className="mb-6 animate-fade-up">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Live now — answering calls for UK trades 24/7
        </Badge>

        <h1 className="max-w-4xl animate-fade-up text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
          Never Miss a <span className="text-gradient">£500 Job</span> While on
          the Tools
        </h1>

        <p className="mt-6 max-w-2xl animate-fade-up text-lg text-muted-foreground md:text-xl">
          <span className="font-semibold text-foreground">SiteRing AI</span>:
          Your 24/7 AI Receptionist built for UK Trades. Every call answered in
          seconds — job details captured, emergencies flagged, and leads sent
          straight to your phone.
        </p>

        <div className="mt-8 flex animate-fade-up flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/signup">
              Start 7-Day Trial <ArrowRight size={18} />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="#how-it-works">
              <PhoneCall size={18} /> See how it works
            </Link>
          </Button>
        </div>

        <div className="mt-8 flex animate-fade-up flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row sm:gap-6">
          <span className="flex items-center gap-1.5">
            <BadgeCheck size={16} className="text-emerald-400" />
            500 minutes included
          </span>
          <span className="flex items-center gap-1.5">
            <BadgeCheck size={16} className="text-emerald-400" />
            Zero setup fees
          </span>
          <span className="flex items-center gap-1.5">
            <BadgeCheck size={16} className="text-emerald-400" />
            Cancel anytime
          </span>
        </div>

        {/* Mock call card */}
        <div className="card-glow mt-14 w-full max-w-2xl animate-fade-up rounded-2xl border border-border bg-card/80 p-5 text-left backdrop-blur">
          <div className="flex items-center gap-3 border-b border-border/60 pb-4">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
              <PhoneCall size={18} className="text-emerald-400" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">
                Incoming call answered · 02:14 AM
              </p>
              <p className="text-xs text-muted-foreground">
                Burst pipe — E14 9RT · Caller: Sarah M.
              </p>
            </div>
            <Badge variant="destructive">Emergency</Badge>
          </div>
          <div className="space-y-2.5 pt-4 text-sm">
            <p className="max-w-[90%] rounded-xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-muted-foreground">
              “Hi, it&apos;s Sarah — water&apos;s pouring through my kitchen
              ceiling, can someone come out tonight?”
            </p>
            <p className="ml-auto max-w-[90%] rounded-xl rounded-tr-sm bg-emerald-500/15 px-3.5 py-2.5 text-emerald-100">
              “I&apos;m sorry to hear that, Sarah. I&apos;ve logged this as an
              emergency for AquaFix Plumbing — postcode E14 9RT. They&apos;ll
              call you back within minutes.”
            </p>
            <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              Lead alert sent to contractor via SMS + email in 8 seconds
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
