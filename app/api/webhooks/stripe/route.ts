import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import type { SubscriptionStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/** Map Stripe subscription states → our `profiles.subscription_status`. */
function mapSubscriptionStatus(
  status: Stripe.Subscription.Status,
): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "unpaid":
    case "incomplete":
    case "paused":
    default:
      return "unpaid";
  }
}

async function activateSubscription(
  userId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const admin = createAdminClient();
  const status = mapSubscriptionStatus(subscription.status);

  const { error } = await admin
    .from("profiles")
    .update({
      stripe_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      subscription_status: status,
    })
    .eq("id", userId);

  if (error) throw new Error(`profiles update failed: ${error.message}`);

  // Reset the monthly minute counter when a new billing period starts.
  await admin
    .from("telephony_provisioning")
    .update({ minutes_used_this_period: 0, forwarding_active: true })
    .eq("user_id", userId);
}

/**
 * POST /api/webhooks/stripe
 * Stripe event receiver. Configure in the Stripe Dashboard with:
 *   checkout.session.completed · invoice.paid ·
 *   customer.subscription.updated · customer.subscription.deleted
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing stripe signature or webhook secret." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (subscriptionId) {
          const subscription =
            await getStripe().subscriptions.retrieve(subscriptionId);
          const userId =
            session.metadata?.supabase_user_id ??
            subscription.metadata?.supabase_user_id;

          if (userId) {
            await activateSubscription(userId, subscription);
          } else {
            console.warn(
              "[stripe-webhook] checkout.session.completed without supabase_user_id",
            );
          }
        } else {
          console.warn(
            "[stripe-webhook] checkout.session.completed without subscription id",
          );
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subscriptionId) {
          const subscription =
            await getStripe().subscriptions.retrieve(subscriptionId);
          const userId = subscription.metadata?.supabase_user_id;
          if (userId) await activateSubscription(userId, subscription);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (userId) {
          const status =
            event.type === "customer.subscription.deleted"
              ? ("canceled" as const)
              : mapSubscriptionStatus(subscription.status);

          const { error } = await createAdminClient()
            .from("profiles")
            .update({
              stripe_subscription_id: subscription.id,
              subscription_status: status,
            })
            .eq("id", userId);

          if (error)
            throw new Error(`profiles update failed: ${error.message}`);

          // Pause forwarding if the subscription is no longer valid.
          if (status === "canceled" || status === "unpaid") {
            await createAdminClient()
              .from("telephony_provisioning")
              .update({ forwarding_active: false })
              .eq("user_id", userId);
          }
        }
        break;
      }

      default:
        // Unhandled event types are acknowledged but ignored.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[stripe-webhook] handler failed for ${event.type}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Handler failed." },
      { status: 500 },
    );
  }
}
