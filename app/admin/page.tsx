import { redirect } from "next/navigation";
import { DemoPhoneForm, StatusSelect } from "@/components/admin-controls";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSessionUser, isAdminUser } from "@/lib/auth";
import { getDemoPhoneNumber } from "@/lib/demo-phone";
import {
  formatGbpFromPence,
  formatPercent,
  INCLUDED_MINUTES,
  INFRA_COST_PENCE,
  infraCostPenceForMinutes,
  netMargin,
  netProfitPence,
  PLAN_PRICE_PENCE,
  STACK_ALLOCATION_PENCE,
  STACK_LABELS,
  stripeFeePence,
} from "@/lib/pricing";
import { londonPeriod } from "@/lib/period";
import type { CallLog } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

type AccountRow = {
  id: string;
  business_name: string | null;
  trade_type: string | null;
  phone_number: string | null;
  used_minutes: number | null;
  minutes_period: string | null;
  subscription_status: string | null;
  user_id: string;
};

export default async function AdminPage() {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!supabase || !(await isAdminUser(user))) {
    return (
      <>
        <SiteHeader signedIn />
        <main className="mx-auto max-w-xl px-5 py-20">
          <h1 className="serif text-4xl">Admin only</h1>
          <p className="mt-3 text-muted">This account is not on the admin list. Set ADMIN_EMAILS or flip profiles.role to admin.</p>
        </main>
      </>
    );
  }

  const [{ data: accounts }, { data: calls }, demoPhone] = await Promise.all([
    supabase.from("business_profiles").select("id, business_name, trade_type, phone_number, used_minutes, minutes_period, subscription_status, user_id").order("created_at", { ascending: false }),
    supabase.from("call_logs").select("*").order("started_at", { ascending: false }).limit(40),
    getDemoPhoneNumber(),
  ]);

  const rows = (accounts ?? []) as AccountRow[];
  const active = rows.filter((row) => row.phone_number && row.subscription_status !== "suspended");
  const period = londonPeriod();
  const minutesFor = (row: AccountRow) =>
    row.minutes_period && row.minutes_period !== period ? 0 : Number(row.used_minutes ?? 0);
  const minutes = rows.reduce((sum, row) => sum + minutesFor(row), 0);
  const mrr = active.length * PLAN_PRICE_PENCE;
  const stripe = active.length * stripeFeePence();
  const infra = infraCostPenceForMinutes(minutes);
  const liveNet = mrr - stripe - infra;

  return (
    <>
      <SiteHeader signedIn />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass-deep">Four-provider stack</p>
            <h1 className="serif mt-2 text-4xl">Admin</h1>
          </div>
          <ThemeToggle />
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <Metric label="MRR" value={formatGbpFromPence(mrr)} note={`${active.length} active accounts × £150`} />
          <Metric label="Minutes consumed" value={String(minutes)} note="Sum of used_minutes" />
          <Metric label="Active contractors" value={String(active.length)} note="Number assigned, not suspended" />
          <Metric label="Live net" value={formatGbpFromPence(liveNet)} note="MRR minus Stripe and consumed infra" />
        </section>

        <section className="mt-8 rounded-3xl border border-line bg-card p-6">
          <h2 className="serif text-2xl">Plan economics — 500 minutes</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Planning allocation for Twilio + LiveKit + Cartesia + OpenAI. The parts sum to the £9.40 infrastructure estimate. They are not a live invoice feed.
          </p>
          <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2">
            <Row label="Monthly plan value" value={formatGbpFromPence(PLAN_PRICE_PENCE)} />
            {(Object.keys(STACK_ALLOCATION_PENCE) as Array<keyof typeof STACK_ALLOCATION_PENCE>).map((key) => (
              <Row key={key} label={STACK_LABELS[key]} value={formatGbpFromPence(STACK_ALLOCATION_PENCE[key])} />
            ))}
            <Row label="Est. infrastructure cost (500 mins)" value={formatGbpFromPence(INFRA_COST_PENCE)} strong />
            <Row label="Est. Stripe fee (1.5% + 20p)" value={formatGbpFromPence(stripeFeePence())} />
            <Row label="Net profit per active account" value={`${formatGbpFromPence(netProfitPence())} / month`} strong />
            <Row label="Net margin" value={`${formatPercent(netMargin())} (~92%)`} strong />
            <Row label="Included minutes" value={String(INCLUDED_MINUTES)} />
          </dl>
        </section>

        <div className="mt-8">
          <DemoPhoneForm current={demoPhone ?? ""} />
        </div>

        <section className="mt-8">
          <h2 className="serif text-2xl">Contractor accounts</h2>
          <div className="mt-4 overflow-x-auto rounded-3xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-card-2 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Trade</th>
                  <th className="px-4 py-3 font-medium">Number</th>
                  <th className="px-4 py-3 font-medium">Minutes</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td className="px-4 py-4 text-muted" colSpan={5}>No contractor accounts yet.</td></tr>
                ) : null}
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-4 py-3">{row.business_name || "Unnamed"}</td>
                    <td className="px-4 py-3">{row.trade_type}</td>
                    <td className="px-4 py-3">{row.phone_number || "—"}</td>
                    <td className="px-4 py-3">{row.used_minutes ?? 0}</td>
                    <td className="px-4 py-3"><StatusSelect profileId={row.id} status={row.subscription_status || "trial"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="serif text-2xl">Call history</h2>
          <div className="mt-4 overflow-x-auto rounded-3xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-card-2 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Dialed</th>
                  <th className="px-4 py-3 font-medium">Caller</th>
                  <th className="px-4 py-3 font-medium">Minutes</th>
                  <th className="px-4 py-3 font-medium">Booking text</th>
                </tr>
              </thead>
              <tbody>
                {((calls ?? []) as CallLog[]).length === 0 ? (
                  <tr><td className="px-4 py-4 text-muted" colSpan={5}>No calls yet.</td></tr>
                ) : null}
                {((calls ?? []) as CallLog[]).map((call) => (
                  <tr key={call.id} className="border-t border-line">
                    <td className="px-4 py-3">{new Date(call.started_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}</td>
                    <td className="px-4 py-3">{call.phone_number || "—"}</td>
                    <td className="px-4 py-3">{call.caller_number || "Withheld"}</td>
                    <td className="px-4 py-3">{call.billed_minutes}</td>
                    <td className="px-4 py-3">{call.booking_link_sent ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="rounded-3xl border border-line bg-card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="serif mt-2 text-3xl">{value}</p>
      <p className="mt-2 text-xs text-muted">{note}</p>
    </article>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? "font-semibold" : ""}>{value}</dd>
    </div>
  );
}
