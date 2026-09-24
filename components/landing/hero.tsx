import Link from "next/link";
import { ArrowRight, BadgeCheck, PhoneCall, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DEMO_CALL_NUMBER, DEMO_CALL_TEL_LINK } from "@/lib/site";

export function Hero({
  demoNumber = DEMO_CALL_NUMBER,
  demoTel = DEMO_CALL_TEL_LINK,
}: {
  demoNumber?: string;
  demoTel?: string;
}) {
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
          24/7 AI Receptionist — built for UK trades
        </Badge>

        <h1 className="max-w-4xl animate-fade-up text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
          24/7 AI Receptionist for UK Trade Contractors — Never Miss a
          High-Value Lead Again.
        </h1>

        <p className="mt-6 max-w-2xl animate-fade-up text-lg text-muted-foreground md:text-xl">
          <span className="font-semibold text-foreground">SiteRing AI</span>{" "}
          answers every call in seconds — day, night and weekends. It qualifies
          the job, takes the details and books the appointment, so you never
          lose another job to a missed call again.
        </p>

        <div className="mt-8 flex animate-fade-up flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <a href={demoTel}>
              <PhoneCall size={18} /> Call the live demo: {demoNumber}
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="#pricing">
              Get SiteRing AI — £150/mo <ArrowRight size={18} />
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
            Real UK (+44) number
          </span>
          <span className="flex items-center gap-1.5">
            <BadgeCheck size={16} className="text-emerald-400" />
            30-day money-back guarantee
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
              Job details sent to the contractor in 8 seconds
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
