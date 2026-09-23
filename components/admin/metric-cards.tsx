import { Banknote, Clock3, TrendingUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatGBP } from "@/lib/utils";
import type { AdminMetrics } from "@/lib/admin";

export function MetricCards({ metrics }: { metrics: AdminMetrics }) {
  const cards = [
    {
      icon: Banknote,
      label: "Monthly Recurring Revenue",
      value: formatGBP(metrics.mrrPence),
      hint: `${metrics.activeSubscribers} paying × £150`,
    },
    {
      icon: Users,
      label: "Active Subscribers",
      value: String(metrics.activeSubscribers),
      hint: `${metrics.totalCustomers} total · ${metrics.trialingSubscribers} trialing`,
    },
    {
      icon: Clock3,
      label: "Minutes Used (all accounts)",
      value: metrics.totalMinutesUsed.toLocaleString("en-GB"),
      hint: "Current billing period",
    },
    {
      icon: TrendingUp,
      label: "Overage Revenue",
      value: formatGBP(metrics.overageRevenuePence),
      hint: `${metrics.overageMinutes.toLocaleString("en-GB")} min over cap @ £0.10`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="bg-card/70">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="bg-violet-500/12 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-violet-400 ring-1 ring-violet-500/25">
              <c.icon size={20} />
            </span>
            <div>
              <p className="text-2xl font-extrabold tracking-tight">
                {c.value}
              </p>
              <p className="text-sm font-medium text-muted-foreground">
                {c.label}
              </p>
              <p className="text-xs text-muted-foreground/70">{c.hint}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
