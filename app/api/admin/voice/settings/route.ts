import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminProfile } from "@/lib/admin";
import { getVoiceSettings, updateVoiceSettings } from "@/lib/voice/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Modular voice-provider settings for the LiveKit pipeline.
 *
 * GET  /api/admin/voice/settings   → the effective settings (row over env)
 * PUT  /api/admin/voice/settings   → upsert the row (Admin → Voice Studio)
 *
 * The voice agent reads the same row when a session starts, so a change here
 * takes effect on the very next call or studio session.
 */

const settingsSchema = z.object({
  tts_provider: z.enum(["fishaudio", "openai"]).optional(),
  tts_model: z.string().trim().max(100).optional(),
  tts_voice: z.string().trim().max(100).nullish(),
  stt_model: z.string().trim().max(100).optional(),
  llm_model: z.string().trim().max(100).optional(),
  fish_latency_mode: z.enum(["normal", "balanced", "low"]).optional(),
});

export async function GET() {
  const admin = await getAdminProfile();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }

  const settings = await getVoiceSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PUT(request: Request) {
  const admin = await getAdminProfile();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }

  let patch: unknown;
  try {
    patch = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(patch);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const settings = await updateVoiceSettings(parsed.data, admin.id);
    return NextResponse.json({ ok: true, settings });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Could not save settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
