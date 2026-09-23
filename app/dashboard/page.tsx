import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatCards } from "@/components/dashboard/stat-cards";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { SetupCard } from "@/components/dashboard/setup-card";
import { CallsTable } from "@/components/dashboard/calls-table";
import { BillingButtons } from "@/components/dashboard/billing-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Dashboard" };

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const [{ data: profile }, { data: telephony }, { data: calls }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("telephony_provisioning")
        .select("*")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("call_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  if (!profile) redirect("/login?next=/dashboard");

  const allCalls = calls ?? [];
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const leadsThisMonth = allCalls.filter(
    (c) =>
      new Date(c.created_at) >= startOfMonth &&
      (c.urgency_level === "Emergency" || c.urgency_level === "Standard Quote"),
  ).length;
  const emergencies = allCalls.filter(
    (c) => c.urgency_level === "Emergency",
  ).length;

  const showBillingCta =
    profile.subscription_status === "inactive" ||
    profile.subscription_status === "canceled";

  return (
    <div className="space-y-6">
      {showBillingCta && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold">
                Your subscription isn&apos;t active yet
              </p>
              <p className="text-sm text-muted-foreground">
                Activate your subscription — £150/mo — and your AI receptionist
                goes live on your number today.
              </p>
            </div>
            <BillingButtons status={profile.subscription_status} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Good to see you
            {profile.owner_name
              ? `, ${profile.owner_name.split(" ")[0]}`
              : ""}{" "}
            👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what your AI receptionist has been up to.
          </p>
        </div>
        <Badge variant="secondary">
          {profile.trade_type ?? "General Trade"} ·{" "}
          {profile.subscription_status}
        </Badge>
      </div>

      <StatCards
        totalCalls={allCalls.length}
        leadsThisMonth={leadsThisMonth}
        emergencies={emergencies}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <UsageMeter
          used={telephony?.minutes_used_this_period ?? 0}
          cap={telephony?.monthly_cap_minutes ?? 500}
        />
        <SetupCard assignedNumber={telephony?.assigned_phone_number ?? null} />
      </div>

      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="text-base">Recent Call Logs & Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <CallsTable calls={allCalls} />
        </CardContent>
      </Card>
    </div>
  );
}
