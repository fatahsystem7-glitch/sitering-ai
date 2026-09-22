import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, PRICING } from "@/lib/stripe";

/**
 * POST /api/checkout
 * Creates a Stripe Checkout Session for the £150/mo plan (with trial)
 * plus a metered overage price for minutes beyond 500.
 * Requires an authenticated user.
 */
export async function POST() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      );
    }

    const basePrice = process.env.STRIPE_PRICE_ID_SUBSCRIPTION;
    const overagePrice = process.env.STRIPE_PRICE_ID_OVERAGE;
    if (!basePrice) {
      return NextResponse.json(
        { error: "Subscription price is not configured." },
        { status: 500 },
      );
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id, business_name")
      .eq("id", user.id)
      .single();

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Reuse (or create) the Stripe customer and persist the mapping.
    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.business_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        { price: basePrice, quantity: 1 },
        // Metered overage (£0.10/min) — only attach if configured.
        ...(overagePrice ? [{ price: overagePrice }] : []),
      ],
      subscription_data: {
        trial_period_days: PRICING.trialDays,
        metadata: { supabase_user_id: user.id },
      },
      metadata: { supabase_user_id: user.id },
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/dashboard?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed." },
      { status: 500 },
    );
  }
}
