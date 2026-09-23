import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  requireAdmin,
  MONTHLY_PRICE_PENCE,
  OVERAGE_PENCE_PER_MINUTE,
  type AdminMetrics,
} from "@/lib/admin";
import { MetricCards } from "@/components/admin/metric-cards";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin Overview" };

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin("/admin");
  const supabase = createClient();

  const [{ data: profiles }, { data: telephony }, { data: recentCalls }] =
    await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("telephony_provisioning").select("*"),
      supabase
        .from("call_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const allProfiles = profiles ?? [];
  const allTelephony = telephony ?? [];

  const active = allProfiles.filter(
    (p) => p.subscription_status === "active",
  ).length;
  const trialing = allProfiles.filter(
    (p) => p.subscription_status === "trialing",
  ).length;
  const totalMinutes = allTelephony.reduce(
    (s, t) => s + (t.minutes_used_this_period ?? 0),
    0,
  );
  const overageMinutes = allTelephony.reduce(
    (s, t) =>
      s +
      Math.max(
        0,
        (t.minutes_used_this_period ?? 0) - (t.monthly_cap_minutes ?? 500),
      ),
    0,
  );

  const metrics: AdminMetrics = {
    mrrPence: active * MONTHLY_PRICE_PENCE,
    activeSubscribers: active,
    trialingSubscribers: trialing,
    totalCustomers: allProfiles.filter((p) => !p.is_admin && p.role !== "admin")
      .length,
    totalMinutesUsed: totalMinutes,
    overageMinutes,
    overageRevenuePence: overageMinutes * OVERAGE_PENCE_PER_MINUTE,
  };

  const businessOf = new Map(allProfiles.map((p) => [p.id, p.business_name]));
  const topUsage = [...allTelephony]
    .sort((a, b) => b.minutes_used_this_period - a.minutes_used_this_period)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-sm text-muted-foreground">
          Revenue, subscribers and usage across every SiteRing account.
        </p>
      </div>

      <MetricCards metrics={metrics} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Latest conversations</CardTitle>
            <Link
              href="/admin/conversations"
              className="flex items-center gap-1 text-sm font-medium text-violet-400 hover:underline"
            >
              View all <ArrowRight size={14} />
            </Link>
          </CardHeader>
          <CardContent>
            {(recentCalls ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No calls logged yet.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {(recentCalls ?? []).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {c.caller_name ?? "Unknown"} ·{" "}
                        {businessOf.get(c.user_id) ?? "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.trade_issue_summary ?? "No summary"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(c.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Top accounts by usage</CardTitle>
            <Link
              href="/admin/customers"
              className="flex items-center gap-1 text-sm font-medium text-violet-400 hover:underline"
            >
              Manage <ArrowRight size={14} />
            </Link>
          </CardHeader>
          <CardContent>
            {topUsage.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No usage recorded yet.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {topUsage.map((t) => (
                  <li
                    key={t.user_id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-sm"
                  >
                    <p className="truncate font-medium">
                      {businessOf.get(t.user_id) ?? t.user_id.slice(0, 8)}
                    </p>
                    <Badge variant="secondary" className="shrink-0 font-mono">
                      {t.minutes_used_this_period}/{t.monthly_cap_minutes} min
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
