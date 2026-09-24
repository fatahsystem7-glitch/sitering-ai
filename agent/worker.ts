import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  llm,
  voice,
} from "@livekit/agents";
import * as cartesia from "@livekit/agents-plugin-cartesia";
import * as openai from "@livekit/agents-plugin-openai";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { renderReceptionistPrompt } from "../lib/prompts/receptionist.ts";

const AGENT_FILE = fileURLToPath(import.meta.url);

type Service = { name?: string; price?: string; duration?: string };
type ReceptionProfile = {
  id: string;
  user_id: string;
  business_name: string | null;
  trade_type: string | null;
  service_areas: string | null;
  callout_fee: string | null;
  operating_hours: string | null;
  booking_url: string | null;
  custom_instructions: string | null;
  services: Service[];
  phone_number: string | null;
  emergency_forwarding_number: string | null;
  minutes_used: number;
  monthly_cap: number;
};

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function admin() {
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

async function loadProfile(dialed: string): Promise<ReceptionProfile | null> {
  const supabase = admin();
  if (!supabase || !dialed) return null;
  const wanted = digits(dialed);
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
    user_id: line.user_id,
    business_name: reception?.business_name ?? account?.business_name ?? null,
    trade_type: reception?.trade_type ?? account?.trade_type ?? null,
    service_areas: reception?.service_areas ?? null,
    callout_fee: reception?.callout_fee ?? null,
    operating_hours: reception?.operating_hours ?? null,
    booking_url: reception?.booking_url ?? null,
    custom_instructions: reception?.custom_instructions ?? null,
    services: asServices(reception?.services),
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

async function postCallEnd(body: Record<string, unknown>): Promise<void> {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
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

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
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
        })}\n\nMinutes used this period: ${profile.minutes_used} of ${profile.monthly_cap}. Keep answering. Do not invent prices.`
      : "This UK number is not linked to a contractor yet. Apologise in one short British sentence and stop. Do not invent a business or a price.";

    const tts = new cartesia.TTS({
      apiKey: process.env.CARTESIA_API_KEY,
      model: "sonic-3",
      language: "en",
      ...(process.env.CARTESIA_VOICE_ID?.trim()
        ? { voice: process.env.CARTESIA_VOICE_ID.trim() }
        : {}),
    });
    tts.prewarm();

    const session = new voice.AgentSession({
      stt: new cartesia.STT({
        apiKey: process.env.CARTESIA_API_KEY,
        model: "ink-2",
        language: "en",
      }),
      llm: new openai.LLM({
        model: "gpt-4o-mini",
        apiKey: process.env.OPENAI_API_KEY,
        temperature: 0.4,
      }),
      tts,
      turnHandling: {
        turnDetection: "stt",
        endpointing: { minDelay: 0 },
        preemptiveGeneration: { enabled: true, preemptiveTts: true },
      },
    });

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
            business_profile_id: profile.id,
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
