import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Props {
  used: number;
  cap: number;
}

export function UsageMeter({ used, cap }: Props) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const remaining = Math.max(0, cap - used);
  const warning = pct >= 80 && pct < 100;
  const exceeded = pct >= 100;

  return (
    <Card className="bg-card/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          Call Minutes
          <span className="font-mono text-sm font-bold">
            {used} / {cap}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress
          value={pct}
          indicatorClassName={cn(
            exceeded
              ? "bg-red-500"
              : warning
                ? "bg-amber-400"
                : "bg-emerald-500",
          )}
        />
        {exceeded ? (
          <p className="flex items-start gap-2 text-sm text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            You&apos;ve used all {cap} included minutes. Extra minutes are
            billed at £0.10/min — answering continues uninterrupted.
          </p>
        ) : warning ? (
          <p className="flex items-start gap-2 text-sm text-amber-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {remaining} minutes left ({pct}% used). Overage is just £0.10/min if
            you exceed {cap}.
          </p>
        ) : (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2
              size={16}
              className="mt-0.5 shrink-0 text-emerald-400"
            />
            {remaining} of {cap} included minutes remaining this period. Resets
            monthly.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
