import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  "24/7 AI call answering",
  "Dedicated UK (+44) number",
  "500 call minutes included (~150 calls)",
  "Instant SMS + email lead alerts",
  "Emergency call forwarding to your mobile",
  "Full transcripts & searchable call log",
  "Works with EE, O2, Vodafone, Three",
  "£0.10/min after 500 minutes — capped fairly",
];

export function Pricing() {
  return (
    <section id="pricing" className="container scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-400">
          Simple pricing
        </p>
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          One plan. Every call answered.
        </h2>
        <p className="mt-4 text-muted-foreground">
          One emergency call-out pays for months of SiteRing. Start free for 7
          days — no card required to look around.
        </p>
      </div>

      <Card className="card-glow mx-auto max-w-md bg-card">
        <CardHeader className="text-center">
          <Badge className="mx-auto mb-2 w-fit">Most popular</Badge>
          <CardTitle className="text-xl">SiteRing Receptionist</CardTitle>
          <CardDescription>For UK trade contractors</CardDescription>
          <div className="pt-4">
            <span className="text-5xl font-extrabold tracking-tight">£150</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <p className="pt-1 text-sm text-emerald-300">
            7-day free trial · then £150/mo
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                  <Check size={12} className="text-emerald-400" />
                </span>
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button size="lg" className="w-full" asChild>
            <Link href="/signup">Start 7-Day Trial</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Cancel anytime · Keep your number during trial
          </p>
        </CardFooter>
      </Card>
    </section>
  );
}
