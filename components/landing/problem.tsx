import { MoonStar, PhoneMissed, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PAINS = [
  {
    icon: PhoneMissed,
    title: "You're on the job — the phone rings",
    body: "You're under a sink, up a ladder, or halfway through a consumer unit. You can't answer. The caller doesn't leave a voicemail — they ring the next plumber, sparkie or builder on Google. Job gone.",
  },
  {
    icon: MoonStar,
    title: "Nights, weekends, holidays — silent",
    body: "Burst pipes, blown fuses and break-ins don't respect office hours. The most valuable emergency jobs come in at 9pm on a Sunday. If nobody answers, that £500+ call-out goes to whoever picks up first.",
  },
  {
    icon: TrendingDown,
    title: "Do the maths on missed calls",
    body: "Miss just one £500 job a week and that's £2,000 a month walking past you. That's over £24,000 a year — lost to voicemail beeps while you were busy earning.",
  },
];

export function Problem() {
  return (
    <section id="problem" className="container scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-red-400">
          The problem
        </p>
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Every missed call is money walking to your competitor
        </h2>
        <p className="mt-4 text-muted-foreground">
          Ask any plumber, sparkie or builder: the phone always rings at the
          worst possible moment. And in the trades, the first firm to answer
          usually wins the job.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {PAINS.map((p) => (
          <Card key={p.title} className="bg-card/60">
            <CardHeader>
              <span className="bg-red-500/12 mb-2 flex h-11 w-11 items-center justify-center rounded-xl text-red-400 ring-1 ring-red-500/25">
                <p.icon size={20} />
              </span>
              <CardTitle className="text-base">{p.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-lg font-medium">
        Voicemail doesn&apos;t win jobs.{" "}
        <span className="text-gradient">Answering does.</span>
      </p>
    </section>
  );
}
