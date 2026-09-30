import { NextResponse } from "next/server";
import { getAdminProfile } from "@/lib/admin";
import { emailConfigured } from "@/lib/email";
import { twilioConfigured } from "@/lib/twilio/client";
import { getVoiceSettings } from "@/lib/voice/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/diagnostics
 *
 * Admin-gated configuration report: confirms each integration's environment
 * variables are actually present and readable by the server, plus the
 * effective (modular) voice pipeline. Used to verify a deployment without
 * triggering a real purchase, send or call.
 */
export async function GET() {
  const admin = await getAdminProfile();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }

  const env = process.env;
  const supabaseConfigured = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
  );

  let providerSettingsSource = "environment-defaults";
  try {
    const settings = await getVoiceSettings();
    providerSettingsSource =
      new Date(settings.updated_at).getTime() > 0
        ? "database (voice_provider_settings)"
        : "environment-defaults";
  } catch {
    /* getVoiceSettings never throws; kept for safety */
  }

  const report = {
    checkedAt: new Date().toISOString(),
    integrations: {
      supabase: {
        configured: supabaseConfigured,
        url: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
        anonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        serviceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
        sessionSecret: Boolean(env.CLIENT_SESSION_SECRET || env.SUPABASE_SERVICE_ROLE_KEY),
        databaseUrl: Boolean(env.DATABASE_URL),
      },
      twilio: {
        configured: twilioConfigured(),
        accountSid: Boolean(env.TWILIO_ACCOUNT_SID),
        authToken: Boolean(env.TWILIO_AUTH_TOKEN),
        sipTrunkSid: Boolean(env.TWILIO_SIP_TRUNK_SID),
        smsFrom: Boolean(env.TWILIO_SMS_FROM),
      },
      brevoSmtp: {
        configured: emailConfigured(),
        smtpUrl: Boolean(env.BREVO_SMTP_URL),
        login: Boolean(env.BREVO_SMTP_LOGIN || env.SMTP_USER),
        key: Boolean(env.BREVO_SMTP_KEY || env.SMTP_PASS),
        from: env.EMAIL_FROM ?? null,
      },
      livekit: {
        configured: Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET),
        url: Boolean(env.LIVEKIT_URL),
        apiKey: Boolean(env.LIVEKIT_API_KEY),
        apiSecret: Boolean(env.LIVEKIT_API_SECRET),
        agentName: env.LIVEKIT_AGENT_NAME ?? null,
      },
      openai: { configured: Boolean(env.OPENAI_API_KEY) },
      fishAudio: {
        configured: Boolean(env.FISH_API_KEY),
        latencyMode: env.FISH_LATENCY_MODE ?? null,
      },
      stripe: {
        configured: Boolean(env.STRIPE_SECRET_KEY),
        webhookSecret: Boolean(env.STRIPE_WEBHOOK_SECRET),
        subscriptionPrice: Boolean(env.STRIPE_PRICE_ID_SUBSCRIPTION),
        overagePrice: Boolean(env.STRIPE_PRICE_ID_OVERAGE),
      },
      webhooks: {
        voiceSecret: Boolean(env.VOICE_WEBHOOK_SECRET),
        cronSecret: Boolean(env.CRON_SECRET),
      },
    },
    voicePipeline: {
      source: providerSettingsSource,
      ttsProvider: (await getVoiceSettings()).tts_provider,
      ttsModel: (await getVoiceSettings()).tts_model,
      sttModel: (await getVoiceSettings()).stt_model,
      llmModel: (await getVoiceSettings()).llm_model,
    },
  };

  return NextResponse.json(report);
}
