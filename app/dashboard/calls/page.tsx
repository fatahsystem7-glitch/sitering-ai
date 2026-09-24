import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth";
import { loadOwnCalls, loadOwnProfile } from "@/lib/load-profile";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calls" };

export default async function CallsPage() {
  const { user } = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard/calls");
  const profile = await loadOwnProfile();
  const calls = await loadOwnCalls();

  return (
    <DashboardShell businessName={profile?.business_name} phoneNumber={profile?.phone_number} email={user.email}>
      <h1 className="serif text-4xl">Call log</h1>
      <p className="mt-2 text-sm text-muted">Inbound calls answered on your number, including whether the booking link was texted.</p>
      <div className="mt-6 space-y-4">
        {calls.length === 0 ? <p className="text-sm text-muted">No calls recorded yet.</p> : null}
        {calls.map((call) => (
          <article key={call.id} className="rounded-3xl border border-line bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{call.caller_number || "Withheld number"}</h2>
              <p className="text-sm text-muted">{new Date(call.started_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}</p>
            </div>
            <p className="mt-1 text-sm text-muted">
              {call.status} · {call.billed_minutes} min · {call.booking_link_sent ? "booking text sent" : "no booking text"}
            </p>
            {call.summary ? <p className="mt-3 text-sm">{call.summary}</p> : null}
            {call.transcript ? (
              <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-card-2 p-4 text-xs leading-relaxed">{call.transcript}</pre>
            ) : null}
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
