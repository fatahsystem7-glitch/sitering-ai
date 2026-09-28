import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { twilioConfigured } from "@/lib/twilio/client";
import { submitUkBundle, type ClientRow } from "@/lib/twilio/compliance";

export const runtime = "nodejs";
// Uploading two documents and waiting on Twilio's evaluation takes longer
// than the default serverless budget.
export const maxDuration = 60;

const FIELDS =
  "id,business_name,business_type,company_number,owner_name,email,phone_number," +
  "address_line1,address_line2,city,postcode,id_document_type,id_document_path," +
  "proof_of_address_path,twilio_bundle_sid,twilio_bundle_status";

/**
 * POST /api/compliance/submit  { client_id }
 *
 * Submits the contractor's UK regulatory bundle to Twilio. Internal:
 * requires the same shared secret the voice webhooks use, because it spends
 * money and uploads identity documents.
 */
export async function POST(request: Request) {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  const provided =
    request.headers.get("x-webhook-secret") ??
    new URL(request.url).searchParams.get("secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (!twilioConfigured()) {
    return NextResponse.json({ error: "Twilio is not configured" }, { status: 503 });
  }

  let clientId: string | undefined;
  try {
    const body = (await request.json()) as { client_id?: string };
    clientId = body.client_id;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!clientId) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: client, error } = await supabase
    .from("clients")
    .select(FIELDS)
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!client) {
    return NextResponse.json({ error: "No such client" }, { status: 404 });
  }

  // Re-submitting an in-flight bundle creates a duplicate Twilio charges for
  // and a second review queue entry. Only a rejection may be retried.
  const existing = client as unknown as { twilio_bundle_sid?: string; twilio_bundle_status?: string };
  if (existing.twilio_bundle_sid && existing.twilio_bundle_status !== "twilio-rejected") {
    return NextResponse.json(
      {
        error: "A bundle has already been submitted for this client.",
        bundle_sid: existing.twilio_bundle_sid,
        status: existing.twilio_bundle_status,
      },
      { status: 409 },
    );
  }

  try {
    const result = await submitUkBundle(client as unknown as ClientRow);

    return NextResponse.json({
      bundle_sid: result.bundleSid,
      status: result.status,
      submitted: result.submitted,
      compliant: result.evaluation.compliant,
      // When it is not compliant this is the sentence to show the contractor.
      message: result.evaluation.summary,
      failures: result.evaluation.failures,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Bundle submission failed";
    // A failure here is usually a missing document or a bad address, which the
    // contractor can fix — so it is a 422, not a 500.
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
