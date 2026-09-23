import { ShieldCheck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "Will my callers know it's AI?",
    a: "Callers hear a clear, natural voice that answers in under 3 seconds and introduces itself as your business's receptionist. It asks for name, postcode, issue and urgency, then confirms you'll call back. Most callers simply appreciate reaching a professional receptionist instead of voicemail — and every call is transcribed so you can review exactly what was said.",
  },
  {
    q: "Do I get a real UK number?",
    a: "Yes. Every account includes a dedicated UK (+44) number shown in your dashboard. You keep your existing mobile number — you simply forward missed calls to your SiteRing number, and the AI answers as your business.",
  },
  {
    q: "How does mobile call forwarding work?",
    a: "Dial **61*YOUR_SITERING_NUMBER# on your phone (replacing YOUR_SITERING_NUMBER with the +44 number in your dashboard) and press call. Calls you don't answer within ~15-20 seconds then divert to SiteRing instead of voicemail. It works on EE, O2, Vodafone, Three and most UK MVNOs. To switch it off, dial ##61#. Full instructions are in your dashboard and settings.",
  },
  {
    q: "What happens after the 500 included minutes?",
    a: "500 minutes covers roughly 150+ typical calls. If you exceed it, extra minutes are billed at just £0.10/min on your next invoice — answering continues uninterrupted with no cut-offs. Your dashboard shows a live usage meter with warnings as you approach the cap.",
  },
  {
    q: "How do emergency jobs reach me?",
    a: "When the AI detects an emergency — burst pipes, live electrics, break-ins — it flags the call, sends you the details instantly by SMS and email, and can forward the live call straight to your emergency number so you take it in real time.",
  },
  {
    q: "What if it doesn't work for my business?",
    a: "Every plan is backed by our 30-day money-back guarantee. If SiteRing AI doesn't pay for itself in your first month, email us and we'll refund you in full. No forms, no hard feelings — and your call history stays exportable.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. Monthly rolling contract — cancel from your billing portal in two clicks. Your number stays active until the end of the billing period.",
  },
];

export function Faq() {
  return (
    <section
      id="faq"
      className="scroll-mt-20 border-t border-border/60 bg-zinc-950/60 py-16 md:py-24"
    >
      <div className="container max-w-3xl">
        <div className="mb-10 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-400">
            FAQ & Guarantees
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Questions from the trade
          </h2>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
          <ShieldCheck size={22} className="mt-0.5 shrink-0 text-emerald-400" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">
              Our 30-day money-back guarantee:
            </span>{" "}
            if SiteRing AI doesn&apos;t win you more jobs than it costs in your
            first month, we refund every penny. The risk is entirely on us.
          </p>
        </div>

        <Accordion
          type="single"
          collapsible
          className="rounded-2xl border border-border bg-card px-6"
        >
          {FAQS.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`}>
              <AccordionTrigger>{f.q}</AccordionTrigger>
              <AccordionContent>{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
