import Link from "next/link";
import { DemoCallButton } from "@/components/demo-call-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { getDemoPhoneNumber } from "@/lib/demo-phone";
import { formatGbpFromPence, INCLUDED_MINUTES, PLAN_PRICE_PENCE } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const trades = ["Plumbing", "Electrical", "Roofing", "Building", "HVAC", "Drainage", "Locksmith", "Decorating"];

const steps = [
  {
    n: "01",
    title: "Tell it how you actually work",
    body: "Trading name, postcodes, call-out fee, and the jobs you do — with the price you want spoken.",
  },
  {
    n: "02",
    title: "Put the +44 number where the calls come from",
    body: "Van door, Google listing, website. Inbound calls land on Twilio and are answered by the receptionist.",
  },
  {
    n: "03",
    title: "They get a text, you get the lead",
    body: "If they want a slot, SiteRing texts your booking link. If they don't, it takes a callback.",
  },
];

const faqs = [
  {
    q: "What happens after 500 minutes?",
    a: "The line politely stops taking new calls until the next calendar month. There is no surprise overage bill.",
  },
  {
    q: "Does it book straight into my diary?",
    a: "It texts your Calendly, website, or form link. It does not pretend it can see your diary.",
  },
  {
    q: "Will it invent a price?",
    a: "No. It only quotes the services and call-out fee you saved. If a price is missing, it offers a callback.",
  },
  {
    q: "Who is it for?",
    a: "UK plumbers, electricians, roofers, builders, HVAC engineers, and similar trade contractors who lose work to voicemail.",
  },
];

export default async function HomePage() {
  const [{ user }, demoNumber] = await Promise.all([getSessionUser(), getDemoPhoneNumber()]);

  return (
    <>
      <SiteHeader signedIn={Boolean(user)} />
      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-14 md:grid-cols-[1.15fr_0.85fr] md:pt-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-deep">UK trade contractors</p>
            <h1 className="serif mt-4 max-w-3xl text-4xl leading-[1.05] tracking-tight md:text-6xl">
              24/7 AI Receptionist for UK Trade Contractors — Never Miss a High-Value Lead Again.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              While you are under a sink or on a roof, SiteRing answers in a calm British voice, quotes your prices, and texts the booking link. One plan. No seats. No voicemail.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <DemoCallButton number={demoNumber} />
              <Link href="/signup" className="inline-flex items-center justify-center rounded-full border border-line bg-card px-5 py-3 text-sm font-semibold">
                Start for {formatGbpFromPence(PLAN_PRICE_PENCE)} / month
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-line pt-6 text-sm">
              <div>
                <dt className="text-muted">Plan</dt>
                <dd className="serif mt-1 text-2xl">{formatGbpFromPence(PLAN_PRICE_PENCE)}</dd>
              </div>
              <div>
                <dt className="text-muted">Included</dt>
                <dd className="serif mt-1 text-2xl">{INCLUDED_MINUTES} min</dd>
              </div>
              <div>
                <dt className="text-muted">Voice</dt>
                <dd className="serif mt-1 text-2xl">Sonic-3</dd>
              </div>
            </dl>
          </div>
          <CallCard />
        </section>

        <section id="trades" className="border-y border-line bg-card/60">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-x-8 gap-y-3 px-5 py-5 text-sm uppercase tracking-[0.16em] text-muted">
            {trades.map((trade) => (
              <span key={trade}>{trade}</span>
            ))}
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-deep">How it works</p>
          <h2 className="serif mt-3 text-4xl tracking-tight">Set it up once. Leave the phone in the van.</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <article key={step.n} className="rounded-3xl border border-line bg-card p-6 shadow-[var(--shadow)]">
                <p className="text-xs font-semibold tracking-[0.18em] text-brass-deep">{step.n}</p>
                <h3 className="serif mt-4 text-2xl">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-5 pb-20">
          <div className="grid gap-8 rounded-[2rem] border border-line bg-ink p-8 text-paper md:grid-cols-[1.1fr_0.9fr] md:p-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass">Single plan</p>
              <h2 className="serif mt-3 text-4xl md:text-5xl">£150 / month</h2>
              <p className="mt-3 text-lg text-paper/75">500 Minutes included / month</p>
              <p className="mt-6 max-w-md text-sm leading-relaxed text-paper/70">
                Enough for a busy contractor who wants every enquiry answered, without a call centre and without a meter that quietly runs up.
              </p>
            </div>
            <ul className="space-y-3 text-sm">
              {[
                "UK +44 number, answered day and night",
                "Your services, areas, hours, and call-out fee injected into every call",
                "Booking link texted the moment they want a slot",
                "Call log and callbacks in the dashboard",
                "Hard stop at 500 minutes — no surprise bill",
              ].map((item) => (
                <li key={item} className="flex gap-3 border-b border-white/10 pb-3">
                  <span className="text-brass">●</span>
                  <span>{item}</span>
                </li>
              ))}
              <li className="pt-2">
                <Link href="/signup" className="inline-flex rounded-full bg-paper px-5 py-3 font-semibold text-ink">
                  Get the line
                </Link>
              </li>
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <h2 className="serif text-4xl tracking-tight">Straight answers</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-5">
                <summary className="cursor-pointer list-none text-lg font-medium">
                  <span className="mr-3 text-brass-deep">+</span>
                  {faq.q}
                </summary>
                <p className="mt-3 max-w-3xl pl-6 text-muted">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function CallCard() {
  return (
    <aside className="rounded-[2rem] border border-line bg-card p-6 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted">
        <span>Live call</span>
        <span className="wave" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </span>
      </div>
      <p className="serif mt-4 text-2xl">Harrow Plumbing Co.</p>
      <p className="text-sm text-muted">Inbound · HA1 · emergency leak</p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed">
        <p><span className="text-brass-deep">Receptionist · </span>Harrow Plumbing, how can I help?</p>
        <p><span className="text-muted">Caller · </span>Kitchen ceiling is pouring. Can someone come tonight?</p>
        <p><span className="text-brass-deep">Receptionist · </span>That is an emergency call-out at £95, waived if the job goes ahead. I can text you the booking link now.</p>
        <p className="rounded-2xl bg-card-2 px-4 py-3 text-pine">Booking link texted to the caller.</p>
      </div>
    </aside>
  );
}
