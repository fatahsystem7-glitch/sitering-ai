import { NextResponse } from "next/server";

import { twilioConfigured } from "@/lib/twilio/client";
import { syncBundles } from "@/lib/twilio/sync";

export const runtime = "nodejs";
export const maxDuration = 300;
// Never cached: this both reads Twilio and spends money.
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/compliance/poll
 *
 * Checks every in-flight Twilio bundle, buys numbers for the ones that have
 * been approved, and records rejection reasons for the ones that have not.
 * Runs on a Vercel cron (see vercel.json) and can be triggered by hand.
 *
 * Auth: Vercel's cron header, or the shared webhook secret.
 */
async function handle(request: Request) {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  const provided =
    request.headers.get("x-webhook-secret") ??
    new URL(request.url).searchParams.get("secret");

  // Vercel signs its own cron invocations with CRON_SECRET.
  const cronHeader = request.headers.get("authorization");
  const isVercelCron =
    Boolean(process.env.CRON_SECRET) && cronHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && (!secret || provided !== secret)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (!twilioConfigured()) {
    return NextResponse.json({ error: "Twilio is not configured" }, { status: 503 });
  }

  try {
    const report = await syncBundles();

    // Surface per-client failures as a 207 so a cron alert can fire while the
    // successful provisions still stand.
    const status = report.errors.length > 0 ? 207 : 200;
    return NextResponse.json(report, { status });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
