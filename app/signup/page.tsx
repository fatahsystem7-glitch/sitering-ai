import { SiteHeader } from "@/components/site-header";
import { AuthForm } from "@/components/auth-form";
import { formatGbpFromPence, INCLUDED_MINUTES, PLAN_PRICE_PENCE } from "@/lib/pricing";

export const metadata = { title: "Get the line" };

export default function SignupPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-5xl gap-10 px-5 py-16 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass-deep">Onboarding</p>
          <h1 className="serif mt-3 text-4xl">Get the line</h1>
          <p className="mt-3 text-muted">
            {formatGbpFromPence(PLAN_PRICE_PENCE)} a month. {INCLUDED_MINUTES} minutes included. After the account, you will set the business profile the receptionist reads on every call.
          </p>
        </div>
        <div className="rounded-3xl border border-line bg-card p-6">
          <AuthForm mode="signup" nextPath="/onboarding" />
        </div>
      </main>
    </>
  );
}
