import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/message
 * Inbound SMS / WhatsApp / voicemail transcript from the messaging provider.
 * Stored against the Client ID so it appears in the unified dashboard.
 */
const messageSchema = z.object({
  client_id: z.string().uuid().optional(),
  assigned_number: z.string().min(5).optional(),
  direction: z.enum(["inbound", "outbound"]).default("inbound"),
  channel: z.enum(["sms", "whatsapp", "voicemail", "web"]).default("sms"),
  contact_name: z.string().max(120).nullish(),
  contact_phone: z.string().max(40).nullish(),
  body: z.string().max(20000).nullish(),
  transcript: z.string().max(100000).nullish(),
  summary: z.string().max(2000).nullish(),
  urgency_level: z
    .enum(["Emergency", "Standard Quote", "General Enquiry"])
    .default("General Enquiry"),
});

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return (
    request.headers.get("x-webhook-secret") === secret ||
    request.nextUrl.searchParams.get("secret") === secret
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: z.infer<typeof messageSchema>;
  try {
    payload = messageSchema.parse(await request.json());
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
    const admin = createAdminClient();

    let clientId = payload.client_id ?? null;
    if (!clientId && payload.assigned_number) {
      const { data } = await admin
        .from("clients")
        .select("id")
        .eq("assigned_phone_number", payload.assigned_number)
        .maybeSingle();
      clientId = data?.id ?? null;
    }

    if (!clientId) {
      return NextResponse.json(
        {
          error:
            "Could not attribute message: provide client_id or a known assigned_number.",
        },
        { status: 422 },
      );
    }

    const { data: inserted, error } = await admin
      .from("message_logs")
      .insert({
        client_id: clientId,
        direction: payload.direction,
        channel: payload.channel,
        contact_name: payload.contact_name ?? null,
        contact_phone: payload.contact_phone ?? null,
        body: payload.body ?? null,
        transcript: payload.transcript ?? null,
        summary: payload.summary ?? null,
        urgency_level: payload.urgency_level,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, id: inserted?.id, client_id: clientId });
  } catch (err) {
    console.error("[message-webhook] handler failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Handler failed." },
      { status: 500 },
    );
  }
}
