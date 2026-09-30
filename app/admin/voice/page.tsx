import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVoiceSettings } from "@/lib/voice/settings";
import { VoiceConfigStudio } from "@/components/admin/voice-config-studio";

export const metadata: Metadata = { title: "Voice Studio" };

export const dynamic = "force-dynamic";

const CLIENT_FIELDS =
  "id,business_name,owner_name,trade_type,operating_hours,services_offered," +
  "greeting_style,custom_instructions,service_areas,callout_fee," +
  "assigned_phone_number,twilio_bundle_status,onboarding_status,updated_at";

/**
 * /admin/voice — LiveKit WebRTC voice configuration studio.
 *
 * The administrator picks a client account, launches a live voice session and
 * configures that client's AI receptionist (business name, operating hours,
 * services, greeting style) through natural conversation. Everything the
 * agent captures is written to the client's Supabase record on-the-fly.
 *
 * The modular provider settings (Fish Audio TTS / OpenAI STT+LLM …) are
 * edited on the same page and picked up by the voice pipeline per session.
 */
export default async function VoiceStudioPage() {
  await requireAdmin("/admin/voice");

  let clientRows: unknown[] = [];
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("clients")
      .select(CLIENT_FIELDS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[voice-studio] Could not load clients:", error);
    }
    clientRows = (data ?? []) as unknown[];
  } catch (cause) {
    // Missing service-role key or a Supabase outage — the studio still
    // renders so provider settings can be reviewed.
    console.error("[voice-studio] Supabase unavailable:", cause);
  }

  const settings = await getVoiceSettings();

  const livekitConfigured = Boolean(
    process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Voice Studio</h1>
        <p className="text-sm text-muted-foreground">
          Launch a live WebRTC voice session with the AI configuration agent and
          set up a client&apos;s receptionist by talking — every parameter is
          saved to their account as you confirm it.
        </p>
      </div>

      <VoiceConfigStudio
        clients={clientRows as never[]}
        settings={settings}
        livekitConfigured={livekitConfigured}
      />
    </div>
  );
}
