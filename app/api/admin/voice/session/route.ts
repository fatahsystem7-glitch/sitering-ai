import { NextResponse } from "next/server";
import { z } from "zod";
import { AccessToken, AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";
import { getAdminProfile } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/voice/session  { client_id }
 *
 * Opens a LiveKit WebRTC voice session between the administrator's browser
 * and the AI configuration agent, scoped to ONE client account:
 *
 *   1. Creates (or reuses) the room  `voice-config-<client_id>`
 *   2. Dispatches the voice agent into that room
 *   3. Returns a join token for the admin's browser microphone
 *
 * Everything the agent captures during the conversation is synced back to
 * the client's Supabase record through /api/webhooks/voice-config.
 */

const sessionSchema = z.object({
  client_id: z.string().uuid("A valid client account is required."),
});

function livekitHttpUrl(): string | null {
  const raw = process.env.LIVEKIT_URL?.trim();
  if (!raw) return null;
  return raw.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://");
}

export async function POST(request: Request) {
  const admin = await getAdminProfile();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  const wsUrl = process.env.LIVEKIT_URL?.trim();
  const httpUrl = livekitHttpUrl();

  if (!apiKey || !apiSecret || !wsUrl || !httpUrl) {
    return NextResponse.json(
      {
        error:
          "LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to run live voice sessions.",
      },
      { status: 503 },
    );
  }

  let clientId: string;
  try {
    const body = (await request.json()) as unknown;
    clientId = sessionSchema.parse(body).client_id;
  } catch {
    return NextResponse.json({ error: "Expected { client_id }." }, { status: 400 });
  }

  // ── The client account this session configures ──────────────────────
  const supabase = createAdminClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select(
      "id,business_name,owner_name,trade_type,operating_hours,services_offered," +
        "greeting_style,custom_instructions,service_areas,callout_fee," +
        "assigned_phone_number,twilio_bundle_status,onboarding_status",
    )
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    console.error("[voice-session] Could not read client:", clientError);
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }
  if (!client) {
    return NextResponse.json({ error: "No such client account." }, { status: 404 });
  }

  // ── Room + agent dispatch ───────────────────────────────────────────
  // The room name is the contract: the agent parses the client id out of
  // `voice-config-<uuid>` and loads that account's configuration.
  const roomName = `voice-config-${clientId}`;
  let dispatched = false;
  const warnings: string[] = [];

  try {
    const rooms = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    // Reuse if it already exists; otherwise create with a 10-minute
    // empty timeout so an abandoned studio session cleans itself up.
    await rooms.createRoom({
      name: roomName,
      emptyTimeout: 10 * 60,
      maxParticipants: 2,
    });
  } catch (cause) {
    console.warn("[voice-session] Room creation failed (continuing):", cause);
    warnings.push("Room pre-creation failed — it will be created on connect.");
  }

  const agentName = process.env.LIVEKIT_AGENT_NAME?.trim();
  if (agentName) {
    try {
      const dispatch = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
      await dispatch.createDispatch(roomName, agentName);
      dispatched = true;
    } catch (cause) {
      console.warn("[voice-session] Agent dispatch failed (continuing):", cause);
      warnings.push(
        `Could not dispatch the "${agentName}" agent — is the worker running? Start it with \`npm run agent\`.`,
      );
    }
  } else {
    // No agent name → the default agent auto-joins every new room.
    dispatched = true;
  }

  // ── Admin browser join token ────────────────────────────────────────
  const token = new AccessToken(apiKey, apiSecret, {
    identity: `admin-${admin.id}`,
    name: admin.owner_name || admin.business_name,
    ttl: 60 * 60, // 1 hour — a configuration session should not outlive this
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    roomAdmin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });

  return NextResponse.json({
    ok: true,
    url: wsUrl,
    token: await token.toJwt(),
    room: roomName,
    dispatched,
    warnings,
    client,
  });
}
