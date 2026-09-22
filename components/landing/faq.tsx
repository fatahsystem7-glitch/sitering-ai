import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "How good is the call quality? Will callers know it's AI?",
    a: "Callers hear a clear, natural UK-friendly voice that answers in under 3 seconds. It introduces itself as your business's receptionist, asks for name, postcode, issue and urgency, then confirms you'll call back. Most callers simply appreciate reaching a human-sounding receptionist instead of voicemail — and every call is transcribed so you can review exactly what was said.",
  },
  {
    q: "Do I get a real UK number?",
    a: "Yes. Every account is assigned a dedicated UK (+44) number shown in your dashboard. You keep your existing mobile number — you simply forward missed calls to your SiteRing number, and the AI answers as your business.",
  },
  {
    q: "How does mobile call forwarding work?",
    a: "Dial **61*YOUR_SITERING_NUMBER# on your phone (replacing YOUR_SITERING_NUMBER with the +44 number in your dashboard) and press call. From then on, calls you don't answer within ~15-20 seconds divert to SiteRing instead of voicemail. It works on EE, O2, Vodafone, Three and most UK MVNOs. To turn it off, dial ##61#. Full step-by-step instructions are in your dashboard.",
  },
  {
    q: "What happens after the 500 included minutes?",
    a: "500 minutes covers roughly 150+ typical calls. If you exceed it, extra minutes are billed at just £0.10/min on your next invoice — no cut-offs mid-month, no surprise blocks. Your dashboard shows a live usage meter with warnings as you approach the cap.",
  },
  {
    q: "How do emergency jobs reach me?",
    a: "When the AI detects an emergency (burst pipes, live electrics, break-ins), it flags the call as an Emergency, sends you an instant SMS/email alert, and — if enabled — can forward the live call straight to your emergency number so you can take it in real time.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. Monthly rolling contract, cancel from your billing portal in two clicks. Your number stays active until the end of the billing period and your call history remains exportable.",
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
            FAQ
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Questions from the trade
          </h2>
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
