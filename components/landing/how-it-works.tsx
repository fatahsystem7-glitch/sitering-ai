import { ClipboardCheck, PhoneForwarded, Rocket } from "lucide-react";

const STEPS = [
  {
    icon: Rocket,
    step: "Step 1",
    title: "Start your trial",
    body: "Sign up in 2 minutes. You instantly get your own dedicated UK (+44) SiteRing number in your dashboard.",
  },
  {
    icon: PhoneForwarded,
    step: "Step 2",
    title: "Forward missed calls",
    body: "Dial **61*YOUR_SITERING_NUMBER# on your mobile. Unanswered calls now route to your AI receptionist instead of voicemail.",
  },
  {
    icon: ClipboardCheck,
    step: "Step 3",
    title: "Get jobs, not voicemails",
    body: "SiteRing answers 24/7, captures name, postcode, issue and urgency — then texts you the lead instantly. Emergencies can auto-forward to you.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-y border-border/60 bg-zinc-950/60 py-16 md:py-24"
    >
      <div className="container">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Setup in minutes
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Live before your next tea break
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-2xl border border-border bg-card p-6"
            >
              <span className="absolute right-5 top-5 text-5xl font-extrabold text-zinc-800">
                {i + 1}
              </span>
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                <s.icon size={20} />
              </span>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                {s.step}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Works with{" "}
            <span className="font-semibold text-foreground">
              EE · O2 · Vodafone · Three · giffgaff · Tesco Mobile
            </span>{" "}
            — any UK network that supports conditional call forwarding
            (virtually all of them).
          </p>
          <p className="mt-3 inline-block rounded-lg bg-zinc-900 px-4 py-2 font-mono text-sm text-emerald-300 ring-1 ring-emerald-500/30">
            **61*+44YOURNUMBER#
          </p>
        </div>
      </div>
    </section>
  );
}
