import { NextResponse } from "next/server";
import twilio from "twilio";
import { billableMinutes, londonPeriod } from "@/lib/period";
import { createAdminClient } from "@/lib/supabase/admin";
import { twilioRequestUrl } from "@/lib/telephony/request-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(
    [...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (token && process.env.NODE_ENV === "production") {
    const valid = twilio.validateRequest(token, signature, twilioRequestUrl(request, "/api/twilio/status"), params);
    if (!valid) return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  const callSid = params.CallSid;
  const duration = Number(params.CallDuration ?? params.DialCallDuration ?? 0);
  const status = params.CallStatus || "completed";
  if (!callSid) return NextResponse.json({ ok: true, ignored: true });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "database not configured" }, { status: 503 });

  const { data: existing } = await admin
    .from("call_logs")
    .select("id, minutes_applied, business_profile_id")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();

  const minutes = billableMinutes(duration);
  if (!existing) {
    const { data: inserted } = await admin
      .from("call_logs")
      .insert({
        twilio_call_sid: callSid,
        phone_number: params.To || null,
        caller_number: params.From || null,
        status,
        duration_seconds: Number.isFinite(duration) ? duration : 0,
        billed_minutes: minutes,
        minutes_applied: false,
        ended_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    return NextResponse.json({ ok: true, id: inserted?.id ?? null, billedByAgent: false });
  }

  await admin
    .from("call_logs")
    .update({
      status,
      duration_seconds: Number.isFinite(duration) ? duration : 0,
      ended_at: new Date().toISOString(),
      twilio_call_sid: callSid,
    })
    .eq("id", existing.id);

  if (!existing.minutes_applied && existing.business_profile_id && minutes > 0) {
    await admin.rpc("add_call_minutes", {
      profile_id: existing.business_profile_id,
      minutes,
      period: londonPeriod(),
    });
    await admin.from("call_logs").update({ minutes_applied: true, billed_minutes: minutes }).eq("id", existing.id);
  }

  return NextResponse.json({ ok: true });
}
