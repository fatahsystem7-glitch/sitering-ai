import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  applyReceptionistConfigUpdate,
  receptionistConfigSchema,
} from "@/lib/voice/receptionist-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/voice-config
 *
 * Called by the LiveKit voice agent during an Admin → Voice Studio session,
 * on-the-fly, every time a receptionist parameter is captured in the natural
 * conversation (business name, operating hours, services, greeting style,
 * extra instructions). The handler writes it straight to that client's row
 * in Supabase (service role) and records the audit trail, so the admin's
 * screen and the next real customer call both see the change immediately.
 *
 * Auth: the same shared `x-webhook-secret` the other voice webhooks use.
 */

const payloadSchema = receptionistConfigSchema.extend({
  client_id: z.string().uuid(),
  session_id: z.string().max(120).optional(),
  admin_user_id: z.string().uuid().optional(),
});

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  // Fail closed in production; allow local development without a secret.
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { client_id, session_id, admin_user_id, ...patch } = parsed.data;

  try {
    const result = await applyReceptionistConfigUpdate({
      clientId: client_id,
      patch,
      source: "admin_voice_session",
      sessionId: session_id,
      adminUserId: admin_user_id,
    });

    // Only the receptionist-relevant fields go back to the agent — it reads
    // them aloud to confirm the save.
    return NextResponse.json({
      ok: true,
      changes: result.changes,
      client: {
        id: result.client.id,
        business_name: result.client.business_name,
        operating_hours: result.client.operating_hours,
        services_offered: result.client.services_offered,
        greeting_style: result.client.greeting_style,
        custom_instructions: result.client.custom_instructions,
        service_areas: result.client.service_areas,
        callout_fee: result.client.callout_fee,
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Sync failed.";
    console.error("[voice-config] Failed to sync:", message);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
