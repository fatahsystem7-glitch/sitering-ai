import {
  BellRing,
  Clock3,
  PiggyBank,
  Smartphone,
  Timer,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BENEFITS = [
  {
    icon: BellRing,
    title: "Instant SMS & Email Lead Alerts",
    body: "The second a call ends, the caller's name, postcode, issue and urgency lands on your phone. Quote while competitors are still on voicemail.",
  },
  {
    icon: Timer,
    title: "500 Minutes Included",
    body: "Roughly 150+ answered calls every month on the base plan. Generous allowance, then just £0.10/min overage — no surprises.",
  },
  {
    icon: Smartphone,
    title: "Mobile Call Forwarding",
    body: "One code — **61*YOUR_NUMBER# — diverts missed calls from EE, O2, Vodafone or Three to your AI receptionist. Takes 30 seconds.",
  },
  {
    icon: PiggyBank,
    title: "Zero Setup Fees",
    body: "No hardware, no onboarding calls, no hidden charges. £150/mo flat, start your 7-day trial and be live the same day.",
  },
  {
    icon: Clock3,
    title: "24/7 — Nights & Weekends",
    body: "Burst pipes don't wait for Monday. SiteRing answers at 2am on a bank holiday with the same professionalism as 2pm Tuesday.",
  },
  {
    icon: Wrench,
    title: "Built for UK Trades",
    body: "Trained on plumbing, electrical, building and locksmith jobs. Understands postcodes, emergencies, and trade-speak out of the box.",
  },
];

export function Benefits() {
  return (
    <section id="benefits" className="container scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-400">
          Why SiteRing AI
        </p>
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Your best employee never sleeps
        </h2>
        <p className="mt-4 text-muted-foreground">
          Missed calls are missed revenue. SiteRing turns every ring into a
          captured, qualified lead — even when you&apos;re under a sink, up a
          ladder, or off the clock.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {BENEFITS.map((b) => (
          <Card
            key={b.title}
            className="group bg-card/60 transition-all hover:border-emerald-500/40 hover:bg-card"
          >
            <CardHeader>
              <span className="bg-emerald-500/12 mb-2 flex h-11 w-11 items-center justify-center rounded-xl text-emerald-400 ring-1 ring-emerald-500/25 transition-all group-hover:bg-emerald-500/20">
                <b.icon size={20} />
              </span>
              <CardTitle className="text-base">{b.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {b.body}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
