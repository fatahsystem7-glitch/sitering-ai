/** Planning unit economics for Twilio + LiveKit + Fish Audio + OpenAI. */
export const PLAN_PRICE_PENCE = 15_000;
export const INCLUDED_MINUTES = 500;
export const INFRA_COST_PENCE = 940;
export const STRIPE_PERCENT = 0.015;
export const STRIPE_FIXED_PENCE = 20;

export const STACK_ALLOCATION_PENCE = {
  twilio: 350,
  livekit: 200,
  openaiStt: 80,
  fishTts: 240,
  openai: 70,
} as const;

export const STACK_LABELS: Record<keyof typeof STACK_ALLOCATION_PENCE, string> = {
  twilio: "Twilio telephony",
  livekit: "LiveKit orchestration",
  openaiStt: "OpenAI gpt-4o-transcribe STT",
  fishTts: "Fish Audio s2.1-pro TTS",
  openai: "OpenAI gpt-4o-mini",
};

export function stripeFeePence(pricePence = PLAN_PRICE_PENCE): number {
  return Math.round(pricePence * STRIPE_PERCENT) + STRIPE_FIXED_PENCE;
}

export function netProfitPence(pricePence = PLAN_PRICE_PENCE): number {
  return pricePence - INFRA_COST_PENCE - stripeFeePence(pricePence);
}

export function netMargin(pricePence = PLAN_PRICE_PENCE): number {
  return pricePence <= 0 ? 0 : netProfitPence(pricePence) / pricePence;
}

export function formatGbpFromPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}
