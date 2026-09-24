import { ListChecks, PhoneCall, PhoneOutgoing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_CALL_NUMBER, DEMO_CALL_TEL_LINK } from "@/lib/site";

const TRY_SAYING = [
  "“Hi, I need a plumber — water's coming through my ceiling.”",
  "“Is this an emergency? My sockets keep tripping.”",
  "“Can I get a quote for a new consumer unit?”",
  "“My front door lock is jammed and I can't lock up.”",
];

const STEPS = [
  {
    icon: PhoneOutgoing,
    title: "1. Ring the number",
    body: "Call from any phone, right now. The AI answers in seconds — just like it will for your customers.",
  },
  {
    icon: ListChecks,
    title: "2. Speak naturally",
    body: "Describe a job like a real customer would. Try an emergency, a quote request, or an awkward question.",
  },
  {
    icon: PhoneCall,
    title: "3. Hear it qualify the job",
    body: "Listen as it takes the name, postcode, issue and urgency — then imagine every one of your missed calls handled this well.",
  },
];

export function DemoCall({
  demoNumber = DEMO_CALL_NUMBER,
  demoTel = DEMO_CALL_TEL_LINK,
}: {
  demoNumber?: string;
  demoTel?: string;
}) {
  return (
    <section id="live-demo" className="container scroll-mt-20 py-16 md:py-24">
      <div className="card-glow relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/10 to-transparent p-8 text-center md:p-14">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
        <div className="relative">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Try it right now — live
          </p>
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
            Don&apos;t take our word for it.{" "}
            <span className="text-gradient">Call the AI.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            This is a live UK test line connected to a SiteRing AI receptionist.
            Ring it, speak naturally, and experience exactly what your callers
            will hear.
          </p>

          <a
            href={demoTel}
            className="mx-auto mt-8 block w-fit rounded-2xl bg-zinc-900 px-8 py-4 font-mono text-2xl font-bold tracking-tight text-emerald-300 ring-1 ring-emerald-500/30 transition-all hover:ring-emerald-500/60 md:text-3xl"
          >
            {demoNumber}
          </a>

          <div className="mt-6 flex justify-center">
            <Button size="lg" asChild>
              <a href={demoTel}>
                <PhoneCall size={18} /> Call now — it answers 24/7
              </a>
            </Button>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 text-left md:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.title}
                className="rounded-2xl border border-border bg-card/80 p-5"
              >
                <s.icon size={20} className="mb-3 text-emerald-400" />
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-border bg-card/80 p-5 text-left">
            <p className="mb-3 text-sm font-semibold">Things to try saying:</p>
            <ul className="space-y-2">
              {TRY_SAYING.map((line) => (
                <li key={line} className="text-sm text-muted-foreground">
                  <span className="mr-2 text-emerald-400">→</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
