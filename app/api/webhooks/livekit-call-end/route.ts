import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, PRICING } from "@/lib/stripe";
import { billableMinutes } from "@/lib/utils";
import type { UrgencyLevel } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * Expected payload from the LiveKit / Twilio voice agent when a call ends.
 *
 * Either `user_id` (Supabase user id) or `assigned_number` (the SiteRing
 * number that was dialled) must be present so we can attribute the call.
 */
const callEndSchema = z.object({
  user_id: z.string().uuid().optional(),
  assigned_number: z.string().min(5).optional(),
  caller_name: z.string().max(120).nullish(),
  caller_phone: z.string().max(40).nullish(),
  trade_issue_summary: z.string().max(2000).nullish(),
  location_postcode: z.string().max(20).nullish(),
  urgency_level: z
    .enum(["Emergency", "Standard Quote", "General Enquiry"])
    .default("General Enquiry"),
  full_transcript: z.string().max(100_000).nullish(),
  ai_summary: z.string().max(2000).nullish(),
  recording_url: z.string().url().max(2000).nullish(),
  duration_seconds: z.number().int().min(0).max(86_400).default(0),
  idempotency_key: z.string().max(120).optional(),
});

type CallEndPayload = z.infer<typeof callEndSchema>;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  // If no secret is configured we refuse (fail closed) in production,
  // but allow local development without one.
  if (!secret) return process.env.NODE_ENV !== "production";

  const header = request.headers.get("x-webhook-secret");
  const query = request.nextUrl.searchParams.get("secret");
  return header === secret || query === secret;
}

async function resolveUserId(payload: CallEndPayload): Promise<string | null> {
  if (payload.user_id) return payload.user_id;

  if (payload.assigned_number) {
    const { data } = await createAdminClient()
      .from("telephony_provisioning")
      .select("user_id")
      .eq("assigned_phone_number", payload.assigned_number)
      .single();
    return data?.user_id ?? null;
  }

  return null;
}

/**
 * Report overage minutes to Stripe Metered Billing (£0.10/min beyond 500).
 * Only the *newly over-cap* portion of this call is reported, so repeated
 * calls never double-bill the same minutes.
 */
async function reportOverageToStripe(
  userId: string,
  totalMinutesAfterCall: number,
  minutesThisCall: number,
  cap: number,
): Promise<void> {
  const overagePriceId = process.env.STRIPE_PRICE_ID_OVERAGE;
  if (!overagePriceId) return; // Metered billing not configured — skip silently.
  if (totalMinutesAfterCall <= cap) return; // Still within allowance.

  const overageBefore = Math.max(
    0,
    totalMinutesAfterCall - minutesThisCall - cap,
  );
  const overageAfter = totalMinutesAfterCall - cap;
  const billableOverage = Math.max(0, overageAfter - overageBefore);
  if (billableOverage <= 0) return;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", userId)
    .single();

  const subscriptionId = profile?.stripe_subscription_id;
  if (!subscriptionId) {
    console.warn(
      `[call-end] user ${userId} has overage but no subscription — skipping Stripe report`,
    );
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const meteredItem = subscription.items.data.find(
    (item) => item.price.id === overagePriceId,
  );
  if (!meteredItem) {
    console.warn(
      `[call-end] subscription ${subscriptionId} has no metered overage item — skipping`,
    );
    return;
  }

  await stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
    quantity: billableOverage,
    timestamp: Math.floor(Date.now() / 1000),
    action: "increment",
  });

  console.log(
    `[call-end] reported ${billableOverage} overage min(s) (£${(billableOverage * PRICING.overagePerMinuteGBP).toFixed(2)}) for user ${userId}`,
  );
}

/**
 * POST /api/webhooks/livekit-call-end
 * Post-call webhook from the voice agent: logs the call, increments usage,
 * and reports any overage to Stripe metered billing.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: CallEndPayload;
  try {
    payload = callEndSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "Invalid payload.",
        details: err instanceof Error ? err.message : undefined,
      },
      { status: 400 },
    );
  }

  try {
    const userId = await resolveUserId(payload);
    if (!userId) {
      return NextResponse.json(
        {
          error:
            "Could not attribute call: provide user_id or a known assigned_number.",
        },
        { status: 422 },
      );
    }

    const admin = createAdminClient();
    const minutes = billableMinutes(payload.duration_seconds);

    // 1. Insert the call log
    const { error: logError } = await admin.from("call_logs").insert({
      user_id: userId,
      caller_name: payload.caller_name ?? null,
      caller_phone: payload.caller_phone ?? null,
      trade_issue_summary: payload.trade_issue_summary ?? null,
      location_postcode: payload.location_postcode ?? null,
      urgency_level: payload.urgency_level as UrgencyLevel,
      full_transcript: payload.full_transcript ?? null,
      ai_summary: payload.ai_summary ?? null,
      recording_url: payload.recording_url ?? null,
      duration_seconds: payload.duration_seconds,
    });
    if (logError)
      throw new Error(`call_logs insert failed: ${logError.message}`);

    // 2. Atomically increment minutes used
    const { data: newTotal, error: rpcError } = await admin.rpc(
      "increment_minutes",
      { p_user_id: userId, p_minutes: minutes },
    );
    if (rpcError)
      throw new Error(`increment_minutes failed: ${rpcError.message}`);

    // 3. Fetch cap for overage math
    const { data: telephony } = await admin
      .from("telephony_provisioning")
      .select("monthly_cap_minutes")
      .eq("user_id", userId)
      .single();
    const cap = telephony?.monthly_cap_minutes ?? PRICING.includedMinutes;

    // 4. Report overage (if any) to Stripe metered billing
    await reportOverageToStripe(userId, newTotal ?? minutes, minutes, cap);

    const profileMinutes = await admin
      .from("business_profiles")
      .update({
        used_minutes: newTotal ?? minutes,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (
      profileMinutes.error &&
      !/does not exist|schema cache|business_profiles/i.test(profileMinutes.error.message)
    ) {
      console.warn(
        "[call-end] business profile minutes not updated:",
        profileMinutes.error.message,
      );
    }

    return NextResponse.json({
      ok: true,
      user_id: userId,
      minutes_billed: minutes,
      minutes_used_this_period: newTotal,
      monthly_cap_minutes: cap,
      overage: Math.max(0, (newTotal ?? 0) - cap),
    });
  } catch (err) {
    console.error("[call-end] handler failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Handler failed." },
      { status: 500 },
    );
  }
}
