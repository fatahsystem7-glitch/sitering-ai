import Stripe from "stripe";

/** Lazily-initialised Stripe SDK (avoids build-time env crashes). */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

  _stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  return _stripe;
}

/** Pricing constants for SiteRing AI. */
export const PRICING = {
  planName: "SiteRing AI Receptionist",
  monthlyPriceGBP: 150,
  includedMinutes: 500,
  overagePerMinuteGBP: 0.1,
} as const;
