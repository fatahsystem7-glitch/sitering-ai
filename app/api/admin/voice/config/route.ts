import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminProfile } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyReceptionistConfigUpdate,
  receptionistConfigSchema,
} from "@/lib/voice/receptionist-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Receptionist parameters for one client account (Admin → Voice Studio).
 *
 * GET  /api/admin/voice/config?client_id=…  → current values
 * POST /api/admin/voice/config             → manual "save now" update
 *
 * The same parameters are captured conversationally in the live voice
 * session; this route is the keyboard fallback and the live preview source.
 */

const CONFIG_FIELDS =
  "id,business_name,owner_name,trade_type,operating_hours,services_offered," +
  "greeting_style,custom_instructions,service_areas,callout_fee," +
  "assigned_phone_number,twilio_bundle_status,onboarding_status,updated_at";

const postSchema = receptionistConfigSchema.extend({
  client_id: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const admin = await getAdminProfile();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }

  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) {
    return NextResponse.json({ error: "client_id is required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: client, error } = await supabase
    .from("clients")
    .select(CONFIG_FIELDS)
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!client) {
    return NextResponse.json({ error: "No such client account." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, client });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminProfile();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { client_id, ...patch } = parsed.data;

  try {
    const result = await applyReceptionistConfigUpdate({
      clientId: client_id,
      patch,
      source: "admin_manual",
      adminUserId: admin.id,
    });
    return NextResponse.json({ ok: true, changes: result.changes, client: result.client });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Update failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
