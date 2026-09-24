export const TRADE_OPTIONS = [
  "Plumbing",
  "Electrical",
  "Roofing",
  "General Building",
  "HVAC",
  "Drainage",
  "Locksmith",
  "Carpentry",
  "Plastering",
  "Painting & Decorating",
  "Landscaping",
  "Other",
] as const;

export type TradeOption = (typeof TRADE_OPTIONS)[number];

export function normaliseTrade(value: string | null | undefined): TradeOption | "" {
  if (!value) return "";
  const found = TRADE_OPTIONS.find((option) => option.toLowerCase() === value.trim().toLowerCase());
  return found ?? "Other";
}
