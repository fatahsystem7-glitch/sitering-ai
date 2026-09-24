/**
 * Official SiteRing plan economics.
 * Infrastructure is a planning allocation across Twilio, LiveKit, Cartesia, and OpenAI
 * that sums exactly to £9.40 for 500 included minutes. It is not a live invoice feed.
 */

export const PLAN_NAME = "SiteRing";
export const PLAN_PRICE_PENCE = 15_000;
export const INCLUDED_MINUTES = 500;
export const INFRA_COST_PENCE = 940;
export const STRIPE_PERCENT = 0.015;
export const STRIPE_FIXED_PENCE = 20;

export const STACK_ALLOCATION_PENCE = {
  twilio: 350,
  livekit: 200,
  cartesiaStt: 80,
  cartesiaTts: 240,
  openai: 70,
} as const;

export const STACK_LABELS: Record<keyof typeof STACK_ALLOCATION_PENCE, string> = {
  twilio: "Twilio telephony",
  livekit: "LiveKit orchestration",
  cartesiaStt: "Cartesia Ink STT",
  cartesiaTts: "Cartesia Sonic-3 TTS",
  openai: "OpenAI gpt-4o-mini",
};

export function stripeFeePence(pricePence = PLAN_PRICE_PENCE): number {
  return Math.round(pricePence * STRIPE_PERCENT) + STRIPE_FIXED_PENCE;
}

export function netProfitPence(pricePence = PLAN_PRICE_PENCE): number {
  return pricePence - INFRA_COST_PENCE - stripeFeePence(pricePence);
}

export function netMargin(pricePence = PLAN_PRICE_PENCE): number {
  if (pricePence <= 0) return 0;
  return netProfitPence(pricePence) / pricePence;
}

export function infraCostPenceForMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.round(minutes * (INFRA_COST_PENCE / INCLUDED_MINUTES));
}

export function formatGbpFromPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function assertEconomics(): void {
  const allocation = Object.values(STACK_ALLOCATION_PENCE).reduce((sum, n) => sum + n, 0);
  if (allocation !== INFRA_COST_PENCE) {
    throw new Error(`Stack allocation ${allocation} does not equal infrastructure cost ${INFRA_COST_PENCE}`);
  }
  if (stripeFeePence() !== 245) {
    throw new Error(`Expected Stripe fee of 245 pence, got ${stripeFeePence()}`);
  }
  if (netProfitPence() !== 13_815) {
    throw new Error(`Expected net profit of 13815 pence, got ${netProfitPence()}`);
  }
}
