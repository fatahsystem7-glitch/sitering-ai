import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  llm,
  voice,
} from "@livekit/agents";
import * as fishaudio from "@livekit/agents-plugin-fishaudio";
import * as openai from "@livekit/agents-plugin-openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { renderReceptionistPrompt } from "../lib/prompts/receptionist.ts";
import {
  adminConfigOpener,
  renderAdminConfigPrompt,
} from "../lib/prompts/admin-config.ts";
import { normalizeFishModel } from "../lib/voice/options.ts";

const AGENT_FILE = fileURLToPath(import.meta.url);

/** Rooms named `voice-config-<client-uuid>` are Admin → Voice Studio sessions. */
const VOICE_CONFIG_ROOM_PREFIX = "voice-config-";

type Service = { name?: string; price?: string; duration?: string };

type ReceptionProfile = {
  id: string;
  client_id: string | null; // set for the new onboarding-model accounts
  user_id: string | null; // set for legacy auth-model accounts
  business_name: string | null;
  trade_type: string | null;
  service_areas: string | null;
  callout_fee: string | null;
  operating_hours: string | null;
  booking_url: string | null;
  custom_instructions: string | null;
  services: Service[];
  greeting_style: string | null;
  phone_number: string | null;
  emergency_forwarding_number: string | null;
  minutes_used: number;
  monthly_cap: number;
};

/** Modular provider selection — mirrored from Admin → Voice Studio. */
type VoiceSettings = {
  tts_provider: "fishaudio" | "openai";
  tts_model: string;
  tts_voice: string | null;
  stt_model: string;
  llm_model: string;
  fish_latency_mode: "normal" | "balanced" | "low";
};

const DEFAULT_SETTINGS: VoiceSettings = {
  tts_provider: "fishaudio",
  tts_model: "fishaudio/s2.1-pro",
  tts_voice: null,
  stt_model: "gpt-4o-transcribe",
  llm_model: "gpt-4o-mini",
  fish_latency_mode: "low",
};

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function attr(participant: { attributes: Record<string, string> }, ...keys: string[]): string {
  for (const key of keys) {
    const value = participant.attributes[key];
    if (value?.trim()) return value.trim();
  }
  return "";
}

function asServices(value: unknown): Service[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as Service[];
}

/** Strings → Service items (the onboarding model stores plain names). */
function asServiceItems(value: unknown): Service[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((name) => ({ name }));
}

/**
 * Loads the modular voice pipeline settings. The Supabase row edited from
 * Admin → Voice Studio wins; environment variables are the fallback so the
 * agent still starts before an admin has touched the UI.
 */
async function loadVoiceSettings(): Promise<VoiceSettings> {
  const settings: VoiceSettings = { ...DEFAULT_SETTINGS };

  const envProvider = process.env.TTS_PROVIDER?.trim().toLowerCase();
  if (envProvider === "fishaudio" || envProvider === "openai") {
    settings.tts_provider = envProvider;
  }
  if (process.env.TTS_MODEL?.trim()) settings.tts_model = process.env.TTS_MODEL.trim();
  if (process.env.STT_MODEL?.trim()) settings.stt_model = process.env.STT_MODEL.trim();
  if (process.env.LLM_MODEL?.trim()) settings.llm_model = process.env.LLM_MODEL.trim();
  if (process.env.TTS_VOICE?.trim()) settings.tts_voice = process.env.TTS_VOICE.trim();
  const latency = process.env.FISH_LATENCY_MODE?.trim().toLowerCase();
  if (latency === "low" || latency === "balanced" || latency === "normal") {
    settings.fish_latency_mode = latency;
  }

  const supabase = admin();
  if (!supabase) return settings;

  try {
    const { data, error } = await supabase
      .from("voice_provider_settings")
      .select("tts_provider,tts_model,tts_voice,stt_model,llm_model,fish_latency_mode")
      .eq("key", "default")
      .maybeSingle();

    if (error) {
      console.warn("[agent] could not read voice_provider_settings:", error.message);
      return settings;
    }
    if (data) return { ...settings, ...(data as VoiceSettings) };
  } catch (cause) {
    console.warn("[agent] voice settings read failed:", cause);
  }
  return settings;
}

type ClientAccountRow = {
  id: string;
  business_name: string;
  owner_name: string;
  trade_type: string | null;
  service_areas: string | null;
  callout_fee: string | null;
  operating_hours: string | null;
  custom_instructions: string | null;
  services_offered: string[];
  greeting_style: string | null;
  assigned_phone_number: string | null;
  emergency_forwarding_number: string;
  minutes_used_this_period: number;
  monthly_cap_minutes: number;
  onboarding_status: string;
};

const CLIENT_FIELDS =
  "id,business_name,owner_name,trade_type,service_areas,callout_fee,operating_hours," +
  "custom_instructions,services_offered,greeting_style,assigned_phone_number," +
  "emergency_forwarding_number,minutes_used_this_period,monthly_cap_minutes,onboarding_status";

/** The client record behind an Admin → Voice Studio session. */
async function loadClientAccount(clientId: string): Promise<ClientAccountRow | null> {
  const supabase = admin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_FIELDS)
    .eq("id", clientId)
    .maybeSingle();
  if (error) {
    console.error("[agent] could not load client account:", error.message);
    return null;
  }
  return data ? (data as unknown as ClientAccountRow) : null;
}

function parseVoiceConfigRoom(roomName: string): string | null {
  if (!roomName.startsWith(VOICE_CONFIG_ROOM_PREFIX)) return null;
  const clientId = roomName.slice(VOICE_CONFIG_ROOM_PREFIX.length);
  return /^[0-9a-f-]{36}$/i.test(clientId) ? clientId : null;
}

/** One receptionist profile for either account model, matched by dialled number. */
async function loadProfile(dialed: string): Promise<ReceptionProfile | null> {
  const supabase = admin();
  if (!supabase || !dialed) return null;
  const wanted = digits(dialed);

  // ── New model: the public onboarding form's `clients` row ──────────
  const { data: clientRows } = await supabase
    .from("clients")
    .select(
      "id,business_name,trade_type,service_areas,callout_fee,operating_hours," +
        "custom_instructions,services_offered,greeting_style,assigned_phone_number," +
        "emergency_forwarding_number,minutes_used_this_period,monthly_cap_minutes",
    );
  const client = ((clientRows ?? []) as unknown as ClientAccountRow[]).find(
    (row) => digits(String(row.assigned_phone_number ?? "")) === wanted,
  );

  if (client) {
    return {
      id: client.id,
      client_id: client.id,
      user_id: null,
      business_name: client.business_name,
      trade_type: client.trade_type,
      service_areas: client.service_areas,
      callout_fee: client.callout_fee,
      operating_hours: client.operating_hours,
      booking_url: null,
      custom_instructions: client.custom_instructions,
      services: asServiceItems(client.services_offered),
      greeting_style: client.greeting_style,
      phone_number: client.assigned_phone_number,
      emergency_forwarding_number: client.emergency_forwarding_number,
      minutes_used: Number(client.minutes_used_this_period ?? 0),
      monthly_cap: Number(client.monthly_cap_minutes ?? 500),
    };
  }

  // ── Legacy model: auth users + business_profiles ───────────────────
  const { data: lines } = await supabase
    .from("telephony_provisioning")
    .select("user_id, assigned_phone_number, minutes_used_this_period, monthly_cap_minutes");
  const line = (lines ?? []).find(
    (row) => digits(String(row.assigned_phone_number ?? "")) === wanted,
  );
  if (!line?.user_id) return null;

  const [{ data: account }, { data: reception }] = await Promise.all([
    supabase
      .from("profiles")
      .select("business_name, trade_type, emergency_forwarding_number")
      .eq("id", line.user_id)
      .maybeSingle(),
    supabase.from("business_profiles").select("*").eq("user_id", line.user_id).maybeSingle(),
  ]);

  return {
    id: String(reception?.id ?? line.user_id),
    client_id: null,
    user_id: line.user_id,
    business_name: reception?.business_name ?? account?.business_name ?? null,
    trade_type: reception?.trade_type ?? account?.trade_type ?? null,
    service_areas: reception?.service_areas ?? null,
    callout_fee: reception?.callout_fee ?? null,
    operating_hours: reception?.operating_hours ?? null,
    booking_url: reception?.booking_url ?? null,
    custom_instructions: reception?.custom_instructions ?? null,
    services: asServices(reception?.services),
    greeting_style: null,
    phone_number: line.assigned_phone_number ?? reception?.phone_number ?? null,
    emergency_forwarding_number: account?.emergency_forwarding_number ?? null,
    minutes_used: Number(line.minutes_used_this_period ?? reception?.used_minutes ?? 0),
    monthly_cap: Number(line.monthly_cap_minutes ?? 500),
  };
}

async function sendBookingSms(to: string, from: string | null, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio is not configured");
  const form = new URLSearchParams({ To: to, Body: body });
  if (from) form.set("From", from);
  else if (process.env.TWILIO_SMS_FROM) form.set("From", process.env.TWILIO_SMS_FROM);
  else throw new Error("No SMS from-number");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    },
  );
  if (!response.ok) throw new Error(`Twilio SMS failed (${response.status})`);
}

function transcriptFrom(session: voice.AgentSession): string {
  try {
    const items = session.history?.items ?? [];
    return items
      .map((item) => {
        const role = "role" in item ? String(item.role) : item.type;
        const text =
          "textContent" in item && typeof item.textContent === "string"
            ? item.textContent
            : "";
        return text ? `${role}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n")
      .slice(0, 20_000);
  } catch {
    return "";
  }
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
}

async function postCallEnd(body: Record<string, unknown>): Promise<void> {
  const base = appUrl();
  const url = process.env.VOICE_WEBHOOK_URL || (base ? `${base}/api/webhooks/livekit-call-end` : "");
  if (!url) return;
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-webhook-secret": secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

/**
 * On-the-fly parameter sync for Admin → Voice Studio sessions. Writes the
 * captured parameter straight to the client's Supabase record and returns
 * the saved values so the agent can confirm them aloud.
 */
async function postVoiceConfigUpdate(args: {
  clientId: string;
  sessionId: string;
  adminUserId: string | null;
  patch: Record<string, unknown>;
}): Promise<{ ok: boolean; saved?: Record<string, unknown>; error?: string }> {
  const base = appUrl();
  const url =
    process.env.VOICE_CONFIG_WEBHOOK_URL ||
    (base ? `${base}/api/webhooks/voice-config` : "");
  if (!url) return { ok: false, error: "No app URL configured for config sync" };

  const secret = process.env.VOICE_WEBHOOK_SECRET;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-webhook-secret": secret } : {}),
    },
    body: JSON.stringify({
      client_id: args.clientId,
      session_id: args.sessionId,
      admin_user_id: args.adminUserId,
      ...args.patch,
    }),
  }).catch((cause: unknown) => cause instanceof Error ? cause : new Error("network failure"));

  if (response instanceof Error) return { ok: false, error: response.message };
  const json = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    changes?: Record<string, unknown>;
    error?: string;
  };
  if (!response.ok || !json.ok) {
    return { ok: false, error: json.error ?? `sync failed (${response.status})` };
  }
  return { ok: true, saved: json.changes ?? {} };
}

/** Broadcast a JSON payload to the room's data channel (the studio UI listens). */
async function publishToRoom(ctx: JobContext, payload: Record<string, unknown>): Promise<void> {
  try {
    if (!ctx.room.localParticipant) return;
    await ctx.room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(payload)),
      { reliable: true },
    );
  } catch (cause) {
    console.warn("[agent] could not publish data message:", cause);
  }
}

/**
 * Builds the modular speech pipeline from the selected providers:
 * Fish Audio for expressive TTS (e.g. fishaudio/s2.1-pro) with OpenAI
 * STT/LLM, or OpenAI end-to-end when selected in the Voice Studio.
 */
function buildPipeline(settings: VoiceSettings) {
  const openaiKey = process.env.OPENAI_API_KEY;

  const stt = new openai.STT({
    apiKey: openaiKey,
    model: settings.stt_model,
    language: "en",
  });

  const llm = new openai.LLM({
    model: settings.llm_model,
    apiKey: openaiKey,
    temperature: 0.4,
  });

  let tts: fishaudio.TTS | openai.TTS;
  if (settings.tts_provider === "openai") {
    tts = new openai.TTS({
      apiKey: openaiKey,
      model: settings.tts_model,
      voice: (settings.tts_voice || "alloy") as openai.TTSVoices,
    });
  } else {
    // `latencyMode: "low"` matters on a phone call: the caller hears the
    // first syllable sooner, at a small cost in prosody.
    const voiceId = settings.tts_voice?.trim() || process.env.FISH_VOICE_ID?.trim() || "";
    tts = new fishaudio.TTS({
      apiKey: process.env.FISH_API_KEY ?? "",
      model: normalizeFishModel(settings.tts_model || DEFAULT_SETTINGS.tts_model),
      latencyMode: settings.fish_latency_mode as fishaudio.LatencyMode,
      ...(voiceId ? { voiceId } : {}),
    });
  }
  tts.prewarm();

  return { stt, llm, tts };
}

function newAgentSession(pipeline: ReturnType<typeof buildPipeline>) {
  return new voice.AgentSession({
    // Fish Audio has no STT, so listening always runs on OpenAI — callers
    // read out postcodes and street names, where a weaker model misfires
    // often enough to cost a booking.
    stt: pipeline.stt,
    llm: pipeline.llm,
    tts: pipeline.tts,
    turnHandling: {
      turnDetection: "stt",
      endpointing: { minDelay: 0 },
      preemptiveGeneration: { enabled: true, preemptiveTts: true },
    },
  });
}

/* ─── Admin → Voice Studio configuration session ──────────────────────── */

async function runAdminConfigSession(ctx: JobContext, clientId: string): Promise<void> {
  const account = await loadClientAccount(clientId);
  if (!account) {
    // Still answer, so the admin hears something rather than dead air.
    const session = newAgentSession(buildPipeline(await loadVoiceSettings()));
    await session.start({
      room: ctx.room,
      agent: new voice.Agent({
        instructions:
          "Tell the administrator in one short sentence that this client account could not be found in the database, and end the conversation politely.",
      }),
    });
    return;
  }

  // The admin's Supabase user id rides along in the participant identity
  // (`admin-<uuid>`), so the audit trail knows who made the change.
  let adminUserId: string | null = null;
  for (const participant of ctx.room.remoteParticipants.values()) {
    if (participant.identity.startsWith("admin-")) {
      adminUserId = participant.identity.slice("admin-".length);
      break;
    }
  }

  const settings = await loadVoiceSettings();
  const session = newAgentSession(buildPipeline(settings));

  const saveConfig = llm.tool({
    description:
      "Save receptionist parameters for the client account mid-conversation. " +
      "Call this the moment a detail is confirmed — do not batch until the end. " +
      "Only include the fields being changed.",
    parameters: z.object({
      business_name: z.string().min(2).max(200).optional(),
      operating_hours: z.string().max(200).optional(),
      services: z.array(z.string().min(1).max(100)).max(30).optional(),
      greeting_style: z.string().max(100).optional(),
      custom_instructions: z.string().max(2000).optional(),
      service_areas: z.string().max(500).optional(),
      callout_fee: z.string().max(100).optional(),
    }),
    execute: async (patch) => {
      const result = await postVoiceConfigUpdate({
        clientId,
        sessionId: ctx.room.name ?? "",
        adminUserId,
        patch,
      });

      if (!result.ok) {
        return {
          ok: false,
          spoken: `That could not be saved — ${result.error ?? "unknown error"}. Ask the administrator to try again or use the manual form.`,
        };
      }

      // Live-update the studio panel over the data channel.
      await publishToRoom(ctx, {
        type: "config.update",
        changes: result.saved ?? patch,
        savedAt: new Date().toISOString(),
      });

      return {
        ok: true,
        spoken: "Saved. Confirm what was recorded in one short sentence and move to the next topic.",
        saved: result.saved,
      };
    },
  });

  await session.start({
    room: ctx.room,
    agent: new voice.Agent({
      instructions: renderAdminConfigPrompt({
        businessName: account.business_name,
        tradeType: account.trade_type,
        operatingHours: account.operating_hours,
        services: account.services_offered,
        greetingStyle: account.greeting_style,
        customInstructions: account.custom_instructions,
        assignedNumber: account.assigned_phone_number,
      }),
      tools: { update_receptionist_config: saveConfig },
    }),
  });

  await publishToRoom(ctx, {
    type: "status",
    text: `Configuration session ready for ${account.business_name}.`,
  });

  session.generateReply({ instructions: adminConfigOpener(account.business_name) });
}

/* ─── Inbound customer call ───────────────────────────────────────────── */

async function runReceptionistCall(ctx: JobContext): Promise<void> {
  const participant = await ctx.waitForParticipant();
  const dialed = attr(participant, "sip.trunkPhoneNumber", "sip.trunk_phone_number");
  const caller = attr(participant, "sip.phoneNumber", "sip.phone_number");
  const profile = await loadProfile(dialed);
  const started = Date.now();
  let bookingSent = false;
  let summary = "";
  let callerName = "";
  let urgency: "Emergency" | "Standard Quote" | "General Enquiry" = "General Enquiry";

  const instructions = profile
    ? `${renderReceptionistPrompt({
        business_name: profile.business_name ?? "the contractor",
        trade_type: profile.trade_type,
        service_areas: profile.service_areas,
        callout_fee: profile.callout_fee,
        operating_hours: profile.operating_hours,
        booking_url: profile.booking_url,
        custom_instructions: profile.custom_instructions,
        services: profile.services,
      })}${
        profile.greeting_style
          ? `\n\nGreeting style requested by the business: ${profile.greeting_style}. Match it.`
          : ""
      }\n\nMinutes used this period: ${profile.minutes_used} of ${profile.monthly_cap}. Keep answering. Do not invent prices.`
    : "This UK number is not linked to a contractor yet. Apologise in one short British sentence and stop. Do not invent a business or a price.";

  const session = newAgentSession(buildPipeline(await loadVoiceSettings()));

  const tools = {
    send_booking_link: llm.tool({
      description: "Text the contractor booking_url to the caller. Use when they want to book.",
      parameters: z.object({
        reason: z.string().describe("Why the caller wants the link"),
      }),
      execute: async ({ reason }) => {
        if (!profile?.booking_url) {
          return { ok: false, spoken: "There is no booking link on file. Take a message instead." };
        }
        if (!caller) {
          return { ok: false, spoken: "The caller number is withheld. Ask them to use the website." };
        }
        try {
          await sendBookingSms(
            caller,
            profile.phone_number,
            `${profile.business_name ?? "Your contractor"} booking link: ${profile.booking_url}`,
          );
          bookingSent = true;
          summary = reason;
          return { ok: true, spoken: "The booking text has been sent. Tell them it should arrive shortly." };
        } catch (error) {
          const message = error instanceof Error ? error.message : "SMS failed";
          return { ok: false, spoken: `The text could not be sent (${message}). Take a message instead.` };
        }
      },
    }),
    take_message: llm.tool({
      description: "Save a callback when the booking text cannot be sent.",
      parameters: z.object({
        caller_name: z.string(),
        message: z.string(),
        urgency: z.enum(["emergency", "soon", "routine"]),
      }),
      execute: async ({ caller_name, message, urgency: level }) => {
        callerName = caller_name;
        summary = message;
        urgency = level === "emergency" ? "Emergency" : level === "soon" ? "Standard Quote" : "General Enquiry";
        const supabase = admin();
        if (!supabase || !profile) {
          return { ok: false, spoken: "The message could not be saved. Ask them to call back." };
        }
        const { error } = await supabase.from("callback_requests").insert({
          business_profile_id: profile.user_id ? profile.id : null,
          caller_number: caller || null,
          caller_name,
          message,
          urgency: level,
        });
        if (error) return { ok: false, spoken: "The message could not be saved. Ask them to call back." };
        return { ok: true, spoken: "Confirm their name is saved and the contractor will call them back." };
      },
    }),
  };

  await session.start({
    room: ctx.room,
    agent: new voice.Agent({ instructions, tools }),
  });

  ctx.addShutdownCallback(async () => {
    const seconds = Math.max(0, Math.round((Date.now() - started) / 1000));
    if (!profile) return;
    await postCallEnd({
      // The new onboarding model keys on client_id; the legacy model on user_id.
      client_id: profile.client_id,
      user_id: profile.user_id,
      assigned_number: profile.phone_number,
      caller_name: callerName || null,
      caller_phone: caller || null,
      trade_issue_summary: summary || (bookingSent ? "Booking link sent" : null),
      urgency_level: urgency,
      full_transcript: transcriptFrom(session),
      ai_summary: summary || null,
      duration_seconds: seconds,
      idempotency_key: ctx.room.name,
    });
  });

  session.generateReply({
    instructions: profile
      ? `Greet the caller in one short British sentence and say they have reached ${profile.business_name ?? "the contractor"}.`
      : "Apologise that this number is not set up yet.",
  });
}

/* ─── Entry ───────────────────────────────────────────────────────────── */

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    // Admin → Voice Studio sessions run the configuration conversation
    // instead of the customer receptionist.
    const configClientId = parseVoiceConfigRoom(ctx.room.name ?? "");
    if (configClientId) {
      await runAdminConfigSession(ctx, configClientId);
      return;
    }

    await runReceptionistCall(ctx);
  },
});

function isEntrypoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  cli.runApp(
    new ServerOptions({
      agent: AGENT_FILE,
      agentName: process.env.LIVEKIT_AGENT_NAME || "sitering-receptionist",
    }),
  );
}
