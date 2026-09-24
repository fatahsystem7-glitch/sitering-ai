import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth";
import { loadOwnCallbacks, loadOwnCalls, loadOwnProfile } from "@/lib/load-profile";
import { INCLUDED_MINUTES } from "@/lib/pricing";
import { formatUkPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user } = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");
  const profile = await loadOwnProfile();
  if (!profile?.business_name) redirect("/onboarding");
  const [calls, callbacks] = await Promise.all([loadOwnCalls(), loadOwnCallbacks()]);
  const used = profile.used_minutes ?? 0;
  const ratio = Math.min(1, used / INCLUDED_MINUTES);

  return (
    <DashboardShell businessName={profile.business_name} phoneNumber={profile.phone_number} email={user.email}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass-deep">This month</p>
      <h1 className="serif mt-2 text-4xl">{profile.business_name}</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-line bg-card p-5">
          <p className="text-sm text-muted">Minutes used</p>
          <p className="serif mt-2 text-3xl">{used}<span className="text-lg text-muted"> / {INCLUDED_MINUTES}</span></p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-card-2">
            <div className="h-full bg-brass" style={{ width: `${ratio * 100}%` }} />
          </div>
          {used >= INCLUDED_MINUTES ? (
            <p className="mt-3 text-sm text-signal">Allowance used. New calls will be declined until next month.</p>
          ) : used >= INCLUDED_MINUTES * 0.8 ? (
            <p className="mt-3 text-sm text-brass-deep">Over 80% used. Worth watching before the month turns.</p>
          ) : null}
        </article>
        <article className="rounded-3xl border border-line bg-card p-5">
          <p className="text-sm text-muted">Number callers dial</p>
          <p className="serif mt-2 text-2xl">{profile.phone_number ? formatUkPhone(profile.phone_number) : "Not assigned"}</p>
          <Link href="/dashboard/settings" className="mt-3 inline-block text-sm font-semibold text-brass-deep">Manage number</Link>
        </article>
        <article className="rounded-3xl border border-line bg-card p-5">
          <p className="text-sm text-muted">Booking link</p>
          <p className="mt-2 truncate text-sm">{profile.booking_url || "Not set — the receptionist will take a message instead."}</p>
        </article>
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="serif text-2xl">Recent calls</h2>
          <Link href="/dashboard/calls" className="text-sm font-semibold">All calls</Link>
        </div>
        <CallTable calls={calls.slice(0, 5)} />
      </section>

      <section className="mt-8">
        <h2 className="serif text-2xl">Callbacks</h2>
        {callbacks.length === 0 ? (
          <p className="mt-3 text-sm text-muted">None waiting. Messages taken on a call land here.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {callbacks.map((item) => (
              <li key={item.id} className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
                <p className="font-semibold">{item.caller_name || "Unnamed"} · {item.urgency || "routine"}</p>
                <p className="text-muted">{item.caller_number} — {item.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardShell>
  );
}

function CallTable({ calls }: { calls: Awaited<ReturnType<typeof loadOwnCalls>> }) {
  if (calls.length === 0) return <p className="mt-3 text-sm text-muted">No calls yet.</p>;
  return (
    <div className="mt-4 overflow-x-auto rounded-3xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-card-2 text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">When</th>
            <th className="px-4 py-3 font-medium">Caller</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Minutes</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr key={call.id} className="border-t border-line">
              <td className="px-4 py-3">{new Date(call.started_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}</td>
              <td className="px-4 py-3">{call.caller_number || "Withheld"}</td>
              <td className="px-4 py-3">{call.booking_link_sent ? "Booking text sent" : call.status}</td>
              <td className="px-4 py-3">{call.billed_minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
