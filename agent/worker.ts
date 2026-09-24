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
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { AGENT_ENV_KEYS, missingEnv } from "../lib/env";
import { INCLUDED_MINUTES } from "../lib/pricing";
import { billableMinutes, londonPeriod } from "../lib/period";
import { phoneLookupVariants, toE164 } from "../lib/phone";
import { buildSystemPrompt, greetingInstruction } from "../lib/prompt";
import { createAdminClient } from "../lib/supabase/admin";
import { sendBookingSms } from "../lib/telephony/sms";
import { agentName } from "../lib/telephony/provision";
import type { BusinessProfile, ServiceItem } from "../lib/types";
import { asServices } from "../lib/types";

const AGENT_FILE = fileURLToPath(import.meta.url);

function isEntrypoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

function attr(participant: { attributes: Record<string, string> }, ...keys: string[]): string {
  for (const key of keys) {
    const value = participant.attributes[key];
    if (value?.trim()) return value.trim();
  }
  return "";
}

async function loadProfile(dialed: string): Promise<BusinessProfile | null> {
  const admin = createAdminClient();
  if (!admin || !dialed) return null;
  const { data: rpcData, error: rpcError } = await admin.rpc("profile_by_phone", { raw: dialed });
  const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  if (!rpcError && rpcRow) return normaliseProfile(rpcRow);

  const variants = phoneLookupVariants(dialed);
  if (variants.length === 0) return null;
  const { data } = await admin.from("business_profiles").select("*").in("phone_number", variants).limit(1).maybeSingle();
  return data ? normaliseProfile(data) : null;
}

function normaliseProfile(row: Record<string, unknown>): BusinessProfile {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    phone_number: (row.phone_number as string | null) ?? null,
    business_name: (row.business_name as string | null) ?? null,
    trade_type: (row.trade_type as string | null) ?? null,
    service_areas: (row.service_areas as string | null) ?? null,
    callout_fee: (row.callout_fee as string | null) ?? null,
    operating_hours: (row.operating_hours as string | null) ?? null,
    booking_url: (row.booking_url as string | null) ?? null,
    website_url: (row.website_url as string | null) ?? null,
    custom_instructions: (row.custom_instructions as string | null) ?? null,
    services: asServices(row.services) as ServiceItem[],
    used_minutes: Number(row.used_minutes ?? 0),
    minutes_period: (row.minutes_period as string | null) ?? null,
    subscription_status: (row.subscription_status as string | null) ?? null,
    provisioning_status: (row.provisioning_status as string | null) ?? null,
    provisioning_error: (row.provisioning_error as string | null) ?? null,
  };
}

function effectiveMinutes(profile: BusinessProfile): number {
  if (profile.minutes_period && profile.minutes_period !== londonPeriod()) return 0;
  return profile.used_minutes;
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
            : "content" in item && typeof item.content === "string"
              ? item.content
              : "";
        return text ? `${role}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n")
      .slice(0, 12_000);
  } catch {
    return "";
  }
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const missing = missingEnv(AGENT_ENV_KEYS);
    if (missing.length > 0) {
      throw new Error(`Agent is missing environment variables: ${missing.join(", ")}`);
    }

    await ctx.connect();
    const participant = await ctx.waitForParticipant();
    const dialed = attr(participant, "sip.trunkPhoneNumber", "sip.trunk_phone_number");
    const caller = toE164(attr(participant, "sip.phoneNumber", "sip.phone_number")) ?? attr(participant, "sip.phoneNumber");
    const twilioCallSid = attr(participant, "sip.twilio.callSid", "sip.twilio.call_sid");
    const profile = await loadProfile(dialed);
    const started = Date.now();
    let bookingSent = false;
    let callLogId: string | null = null;

    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin
        .from("call_logs")
        .insert({
          business_profile_id: profile?.id ?? null,
          phone_number: profile?.phone_number ?? (dialed || null),
          caller_number: caller || null,
          direction: "inbound",
          status: "in-progress",
          twilio_call_sid: twilioCallSid || null,
          livekit_room: ctx.room.name ?? null,
        })
        .select("id")
        .maybeSingle();
      callLogId = data?.id ?? null;
    }

    const overQuota = profile ? effectiveMinutes(profile) >= INCLUDED_MINUTES : false;
    const instructions = !profile
      ? "You answer an unconfigured UK trade line. In one short British sentence, apologise that this number is not set up yet and stop. Do not invent a business, a price, or a booking link."
      : overQuota
        ? `You are the receptionist for ${profile.business_name ?? "this contractor"}. The monthly minute allowance is used up. In one short British sentence, say the line cannot take another call until next month, then stop.`
        : buildSystemPrompt(profile);

    const tts = new cartesia.TTS({
      apiKey: process.env.CARTESIA_API_KEY,
      model: "sonic-3",
      language: "en",
      ...(process.env.CARTESIA_VOICE_ID?.trim() ? { voice: process.env.CARTESIA_VOICE_ID.trim() } : {}),
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
      // Cartesia Ink signals end of turn. minDelay 0 avoids stacking a second wait on top.
      // VAD is auto-provisioned so the caller can still interrupt.
      turnHandling: {
        turnDetection: "stt",
        endpointing: { minDelay: 0 },
        preemptiveGeneration: { enabled: true, preemptiveTts: true },
      },
    });

    const tools = {
      send_booking_link: llm.tool({
        description:
          "Text the contractor's online booking link to the caller. Use when they ask to book, want an appointment, or agree to a visit.",
        parameters: z.object({
          reason: z.string().describe("Short reason the caller wants the booking link"),
        }),
        execute: async ({ reason }) => {
          if (!profile?.booking_url) {
            return { ok: false, spoken: "There is no booking link on file. Take a message instead." };
          }
          if (!caller) {
            return {
              ok: false,
              spoken: "The caller number is withheld. Ask them to use the website and do not read a long URL.",
            };
          }
          try {
            await sendBookingSms({
              to: caller,
              bookingUrl: profile.booking_url,
              businessName: profile.business_name ?? "Your contractor",
              fromNumber: profile.phone_number,
            });
            bookingSent = true;
            if (admin && callLogId) {
              await admin.from("call_logs").update({ booking_link_sent: true, summary: reason }).eq("id", callLogId);
            }
            return { ok: true, spoken: "The booking text has been sent. Tell the caller it should arrive in a few seconds." };
          } catch (error) {
            const message = error instanceof Error ? error.message : "SMS failed";
            return { ok: false, spoken: `The text could not be sent (${message}). Take a message instead.` };
          }
        },
      }),
      take_message: llm.tool({
        description: "Save a callback request when the caller cannot book online or the text fails.",
        parameters: z.object({
          caller_name: z.string().describe("Name the caller gives"),
          message: z.string().describe("Job, postcode, and anything the contractor must know"),
          urgency: z.enum(["emergency", "soon", "routine"]).describe("How urgent the job is"),
        }),
        execute: async ({ caller_name, message, urgency }) => {
          if (!admin || !profile) {
            return { ok: false, spoken: "The message could not be saved. Ask them to call back." };
          }
          const { error } = await admin.from("callback_requests").insert({
            business_profile_id: profile.id,
            caller_number: caller || null,
            caller_name,
            message,
            urgency,
          });
          if (error) return { ok: false, spoken: "The message could not be saved. Ask them to call back." };
          return { ok: true, spoken: "Confirm you have taken their name and that the contractor will call them back." };
        },
      }),
    };

    await session.start({
      room: ctx.room,
      agent: new voice.Agent({ instructions, tools }),
    });

    ctx.addShutdownCallback(async () => {
      const seconds = Math.max(0, Math.round((Date.now() - started) / 1000));
      const minutes = overQuota ? 0 : billableMinutes(seconds);
      const transcript = transcriptFrom(session);
      if (!admin || !callLogId) return;
      await admin
        .from("call_logs")
        .update({
          status: "completed",
          duration_seconds: seconds,
          billed_minutes: minutes,
          ended_at: new Date().toISOString(),
          transcript,
          booking_link_sent: bookingSent,
          minutes_applied: minutes > 0,
        })
        .eq("id", callLogId);
      if (profile && minutes > 0) {
        await admin.rpc("add_call_minutes", {
          profile_id: profile.id,
          minutes,
          period: londonPeriod(),
        });
      }
    });

    if (overQuota) {
      const handle = session.say(
        `Sorry, the ${profile?.business_name ?? "contractor"} line has used its included minutes for this month. Please call again next month.`,
        { allowInterruptions: false },
      );
      await handle.waitForPlayout();
      ctx.shutdown("minute allowance used");
      return;
    }

    session.generateReply({
      instructions: greetingInstruction(profile?.business_name),
    });
  },
});

if (isEntrypoint()) {
  cli.runApp(
    new ServerOptions({
      agent: AGENT_FILE,
      agentName: agentName(),
    }),
  );
}
