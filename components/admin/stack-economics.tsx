import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatGbpFromPence,
  INFRA_COST_PENCE,
  INCLUDED_MINUTES,
  netMargin,
  netProfitPence,
  PLAN_PRICE_PENCE,
  STACK_ALLOCATION_PENCE,
  STACK_LABELS,
  stripeFeePence,
} from "@/lib/pricing";

export function StackEconomics() {
  const rows: Array<[string, string]> = [
    ["Monthly plan value", formatGbpFromPence(PLAN_PRICE_PENCE)],
    ...(
      Object.keys(STACK_ALLOCATION_PENCE) as Array<keyof typeof STACK_ALLOCATION_PENCE>
    ).map(
      (key) =>
        [STACK_LABELS[key], formatGbpFromPence(STACK_ALLOCATION_PENCE[key])] as [
          string,
          string,
        ],
    ),
    ["Est. infrastructure cost (500 mins)", formatGbpFromPence(INFRA_COST_PENCE)],
    ["Est. Stripe fee (1.5% + 20p)", formatGbpFromPence(stripeFeePence())],
    ["Net profit per active account", `${formatGbpFromPence(netProfitPence())} / month`],
    ["Net margin", `${(netMargin() * 100).toFixed(1)}% (~92%)`],
    ["Included minutes", String(INCLUDED_MINUTES)],
  ];

  return (
    <Card className="bg-card/70">
      <CardHeader>
        <CardTitle className="text-base">Four-provider stack economics</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Planning allocation for Twilio, LiveKit, Cartesia and OpenAI. The
          parts sum to £9.40 for 500 minutes. This is not a live invoice feed.
        </p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2"
            >
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
