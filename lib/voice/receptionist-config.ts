/**
 * Receptionist parameter sync — the write path behind the Admin → Voice
 * Studio. One shared, validated implementation serves both entry points:
 *
 *   • /api/webhooks/voice-config  — the voice agent calls it on-the-fly
 *     with each parameter it captures mid-conversation
 *   • /api/admin/voice/config     — the manual "save now" form in the studio
 *
 * Both write to the client's row in Supabase with the service-role client
 * and append an audit row to voice_config_updates.
 */

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Client, ClientUpdate } from "@/lib/supabase/types";

export const receptionistConfigSchema = z.object({
  business_name: z.string().trim().min(2).max(200).optional(),
  operating_hours: z.string().trim().max(200).optional(),
  services: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  greeting_style: z.string().trim().max(100).optional(),
  custom_instructions: z.string().trim().max(2000).optional(),
  service_areas: z.string().trim().max(500).optional(),
  callout_fee: z.string().trim().max(100).optional(),
});

export type ReceptionistConfigPatch = z.infer<typeof receptionistConfigSchema>;

export type ConfigUpdateSource = "admin_voice_session" | "admin_manual" | "dashboard";

export type ApplyResult = {
  client: Client;
  changes: Record<string, unknown>;
};

/** Maps the (voice-friendly) patch onto the clients row's column names. */
function toClientUpdate(patch: ReceptionistConfigPatch): ClientUpdate {
  const update: ClientUpdate = {};

  if (patch.business_name !== undefined) update.business_name = patch.business_name;
  if (patch.operating_hours !== undefined) {
    update.operating_hours = patch.operating_hours || null;
  }
  if (patch.services !== undefined) update.services_offered = patch.services;
  if (patch.greeting_style !== undefined) {
    update.greeting_style = patch.greeting_style || null;
  }
  if (patch.custom_instructions !== undefined) {
    update.custom_instructions = patch.custom_instructions || null;
  }
  if (patch.service_areas !== undefined) {
    update.service_areas = patch.service_areas || null;
  }
  if (patch.callout_fee !== undefined) {
    update.callout_fee = patch.callout_fee || null;
  }

  return update;
}

/**
 * Applies a partial receptionist configuration to a client, records the
 * audit trail, and returns the fresh row plus exactly what changed.
 * Throws when the client does not exist or the write fails.
 */
export async function applyReceptionistConfigUpdate(args: {
  clientId: string;
  patch: ReceptionistConfigPatch;
  source: ConfigUpdateSource;
  sessionId?: string | null;
  adminUserId?: string | null;
}): Promise<ApplyResult> {
  const { clientId, patch, source } = args;

  const update = toClientUpdate(patch);
  if (Object.keys(update).length === 0) {
    throw new Error("No receptionist parameters were provided.");
  }

  const supabase = createAdminClient();

  const { data: client, error } = await supabase
    .from("clients")
    .update(update)
    .eq("id", clientId)
    .select("*")
    .single();

  if (error || !client) {
    throw new Error(error?.message ?? "Could not update the client record.");
  }

  // Audit trail — what changed, who changed it, from which session.
  const { error: auditError } = await supabase.from("voice_config_updates").insert({
    client_id: clientId,
    session_id: args.sessionId ?? null,
    admin_user_id: args.adminUserId ?? null,
    changes: update as Record<string, unknown>,
    source,
  });

  if (auditError) {
    // The live record is already saved — the audit row is valuable but must
    // never fail the agent's tool call mid-conversation.
    console.error("[receptionist-config] Audit insert failed:", auditError);
  }

  return { client: client as Client, changes: update as Record<string, unknown> };
}
