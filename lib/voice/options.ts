/**
 * Modular voice-provider option lists — shared by the Admin → Voice Studio
 * UI and the server-side settings service. Pure constants: safe to import
 * from client components.
 *
 * The backend voice pipeline assembles itself from these choices:
 *   STT + LLM  →  OpenAI (gpt-4o-transcribe / gpt-4o-mini …)
 *   TTS        →  Fish Audio (expressive, e.g. fishaudio/s2.1-pro) or OpenAI
 */

export type TtsProviderId = "fishaudio" | "openai";
export type SttProviderId = "openai";
export type LlmProviderId = "openai";

export const TTS_PROVIDERS: {
  id: TtsProviderId;
  label: string;
  description: string;
  models: { id: string; label: string }[];
}[] = [
  {
    id: "fishaudio",
    label: "Fish Audio",
    description:
      "Expressive, human-grade speech. Best default for customer-facing calls.",
    models: [
      { id: "fishaudio/s2.1-pro", label: "s2.1-pro (most expressive)" },
      { id: "fishaudio/s2.1-mini", label: "s2.1-mini (faster, lighter)" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Neutral, low-latency speech on the existing OpenAI key.",
    models: [
      { id: "gpt-4o-mini-tts", label: "gpt-4o-mini-tts" },
      { id: "tts-1", label: "tts-1" },
      { id: "tts-1-hd", label: "tts-1-hd" },
    ],
  },
];

export const STT_MODELS = [
  { id: "gpt-4o-transcribe", label: "gpt-4o-transcribe (recommended for calls)" },
  { id: "whisper-1", label: "whisper-1" },
];

export const LLM_MODELS = [
  { id: "gpt-4o-mini", label: "gpt-4o-mini (recommended)" },
  { id: "gpt-4o", label: "gpt-4o (highest quality)" },
];

export const FISH_LATENCY_MODES = [
  { id: "low", label: "Low — fastest first syllable (best for phone calls)" },
  { id: "balanced", label: "Balanced" },
  { id: "normal", label: "Normal — best prosody" },
] as const;

export const GREETING_STYLES = [
  "Friendly and casual",
  "Professional and formal",
  "Short and to the point",
];

/** "fishaudio/s2.1-pro" → "s2.1-pro" (the LiveKit plugin's model id). */
export function normalizeFishModel(model: string): string {
  return model.trim().replace(/^fishaudio\//i, "");
}
