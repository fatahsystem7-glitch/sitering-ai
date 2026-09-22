import { Flame, PhoneIncoming, UserCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  totalCalls: number;
  leadsThisMonth: number;
  emergencies: number;
}

export function StatCards({ totalCalls, leadsThisMonth, emergencies }: Props) {
  const stats = [
    {
      icon: PhoneIncoming,
      label: "Total Calls Answered",
      value: totalCalls,
      hint: "All time",
    },
    {
      icon: UserCheck,
      label: "Leads Captured This Month",
      value: leadsThisMonth,
      hint: "Quotes + emergencies",
    },
    {
      icon: Flame,
      label: "Emergency Jobs Logged",
      value: emergencies,
      hint: "Flagged urgent",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((s) => (
        <Card key={s.label} className="bg-card/70">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="bg-emerald-500/12 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-emerald-400 ring-1 ring-emerald-500/25">
              <s.icon size={20} />
            </span>
            <div>
              <p className="text-2xl font-extrabold tracking-tight">
                {s.value}
              </p>
              <p className="text-sm font-medium text-muted-foreground">
                {s.label}
              </p>
              <p className="text-xs text-muted-foreground/70">{s.hint}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
