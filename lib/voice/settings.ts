/**
 * Server-side voice provider settings service.
 *
 * The single `voice_provider_settings` row (key 'default') is the source of
 * truth for the modular voice pipeline — it is what the Admin → Voice Studio
 * edits and what the LiveKit agent reads when a session starts. Environment
 * variables are only the fallback, so nothing breaks before an admin has
 * touched the UI.
 *
 * SERVER-ONLY: uses the service-role Supabase client.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  VoiceProviderSettings,
  VoiceProviderSettingsUpdate,
} from "@/lib/supabase/types";
import { normalizeFishModel } from "./options";

export const VOICE_SETTINGS_KEY = "default";

export const DEFAULT_VOICE_SETTINGS: VoiceProviderSettings = {
  key: VOICE_SETTINGS_KEY,
  tts_provider: "fishaudio",
  tts_model: "fishaudio/s2.1-pro",
  tts_voice: null,
  stt_provider: "openai",
  stt_model: "gpt-4o-transcribe",
  llm_provider: "openai",
  llm_model: "gpt-4o-mini",
  fish_latency_mode: "low",
  updated_by: null,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

/** Environment fallbacks, applied on top of the defaults. */
function fromEnv(): VoiceProviderSettingsUpdate {
  const env: VoiceProviderSettingsUpdate = {};

  const ttsProvider = process.env.TTS_PROVIDER?.trim().toLowerCase();
  if (ttsProvider === "fishaudio" || ttsProvider === "openai") {
    env.tts_provider = ttsProvider;
  }
  if (process.env.TTS_MODEL?.trim()) env.tts_model = process.env.TTS_MODEL.trim();
  if (process.env.TTS_VOICE?.trim()) env.tts_voice = process.env.TTS_VOICE.trim();
  if (process.env.STT_MODEL?.trim()) env.stt_model = process.env.STT_MODEL.trim();
  if (process.env.LLM_MODEL?.trim()) env.llm_model = process.env.LLM_MODEL.trim();
  const latency = process.env.FISH_LATENCY_MODE?.trim().toLowerCase();
  if (latency === "low" || latency === "balanced" || latency === "normal") {
    env.fish_latency_mode = latency;
  }

  return env;
}

/**
 * The effective voice pipeline settings: database row (if present) over
 * environment fallback over built-in defaults. Never throws — a Supabase
 * hiccup must not take down token issuance or the agent.
 */
export async function getVoiceSettings(): Promise<VoiceProviderSettings> {
  let stored: VoiceProviderSettingsUpdate | null = null;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("voice_provider_settings")
      .select("*")
      .eq("key", VOICE_SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      console.warn("[voice-settings] Could not read settings row:", error.message);
    } else if (data) {
      stored = data as VoiceProviderSettings;
    }
  } catch (cause) {
    console.warn("[voice-settings] Supabase unavailable, using env defaults:", cause);
  }

  return { ...DEFAULT_VOICE_SETTINGS, ...fromEnv(), ...(stored ?? {}) };
}

function sanitize(patch: VoiceProviderSettingsUpdate): VoiceProviderSettingsUpdate {
  const clean: VoiceProviderSettingsUpdate = {};

  if (patch.tts_provider === "fishaudio" || patch.tts_provider === "openai") {
    clean.tts_provider = patch.tts_provider;
  }
  if (typeof patch.tts_model === "string" && patch.tts_model.trim()) {
    clean.tts_model = patch.tts_model.trim().slice(0, 100);
  }
  clean.tts_voice =
    typeof patch.tts_voice === "string" && patch.tts_voice.trim()
      ? patch.tts_voice.trim().slice(0, 100)
      : null;
  if (typeof patch.stt_model === "string" && patch.stt_model.trim()) {
    clean.stt_model = patch.stt_model.trim().slice(0, 100);
  }
  if (typeof patch.llm_model === "string" && patch.llm_model.trim()) {
    clean.llm_model = patch.llm_model.trim().slice(0, 100);
  }
  if (
    patch.fish_latency_mode === "low" ||
    patch.fish_latency_mode === "balanced" ||
    patch.fish_latency_mode === "normal"
  ) {
    clean.fish_latency_mode = patch.fish_latency_mode;
  }

  // Keep provider and model consistent: a Fish model on the OpenAI provider
  // (or vice versa) would fail at session start, far away from this form.
  if (clean.tts_provider && clean.tts_model) {
    const isFishModel = /^fishaudio\//i.test(clean.tts_model);
    if (clean.tts_provider === "fishaudio" && !isFishModel) {
      clean.tts_model = `fishaudio/${clean.tts_model.replace(/^(openai\/)?/, "")}`;
    } else if (clean.tts_provider === "openai" && isFishModel) {
      clean.tts_model = normalizeFishModel(clean.tts_model);
    }
  }

  return clean;
}

/** Upsert the settings row. Returns the saved row. */
export async function updateVoiceSettings(
  patch: VoiceProviderSettingsUpdate,
  updatedBy?: string,
): Promise<VoiceProviderSettings> {
  const clean = sanitize(patch);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("voice_provider_settings")
    .upsert(
      {
        key: VOICE_SETTINGS_KEY,
        ...clean,
        ...(updatedBy ? { updated_by: updatedBy } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not save voice provider settings.");
  }
  return data as VoiceProviderSettings;
}
