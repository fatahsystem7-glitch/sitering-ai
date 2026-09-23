import { BellRing, CalendarCheck2, Clock3, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Clock3,
    title: "Answers instantly — 24/7",
    body: "Every call picked up in seconds, at 2pm on a Tuesday or 2am on a bank holiday. No voicemail, no engaged tone, no lost caller.",
  },
  {
    icon: ClipboardList,
    title: "Qualifies every trade job",
    body: "The AI takes the caller's name, postcode, the exact issue — burst pipe, tripping electrics, jammed lock — and confirms whether it's an emergency or a standard quote.",
  },
  {
    icon: CalendarCheck2,
    title: "Books the appointment",
    body: "It captures the booking details and preferred times so the job lands in your diary-ready inbox. You just turn up and do the work.",
  },
  {
    icon: BellRing,
    title: "Alerts you in seconds",
    body: "Name, postcode, issue and urgency sent straight to your phone by SMS and email the moment the call ends. Emergencies can be forwarded to you live.",
  },
];

export function Solution() {
  return (
    <section
      id="solution"
      className="scroll-mt-20 border-y border-border/60 bg-zinc-950/60 py-16 md:py-24"
    >
      <div className="container">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-400">
            The solution
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            A receptionist that answers in seconds. At 2pm and 2am.
          </h2>
          <p className="mt-4 text-muted-foreground">
            SiteRing AI is your 24/7 AI receptionist, trained on UK trade work —
            plumbing, electrical, building, locksmiths. It handles the phone so
            you can handle the tools.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card
              key={f.title}
              className="group bg-card/60 transition-all hover:border-emerald-500/40 hover:bg-card"
            >
              <CardHeader>
                <span className="bg-emerald-500/12 mb-2 flex h-11 w-11 items-center justify-center rounded-xl text-emerald-400 ring-1 ring-emerald-500/25 transition-all group-hover:bg-emerald-500/20">
                  <f.icon size={20} />
                </span>
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
