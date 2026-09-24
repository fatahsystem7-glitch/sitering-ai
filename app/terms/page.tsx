import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatGbpFromPence, INCLUDED_MINUTES, PLAN_PRICE_PENCE } from "@/lib/pricing";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="serif text-4xl">Terms</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
          <p>The published plan is {formatGbpFromPence(PLAN_PRICE_PENCE)} per month with {INCLUDED_MINUTES} included minutes. When the allowance is used, new calls are declined until the next month rather than billed as overage.</p>
          <p>You are responsible for the prices, areas, and instructions you save. The receptionist will not invent quotes, but it can only be as accurate as the profile.</p>
          <p>UK geographic numbers may require a Twilio regulatory bundle before they can be purchased. That is a carrier rule, not something the app can waive.</p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
