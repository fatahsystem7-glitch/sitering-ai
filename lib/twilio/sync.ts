/**
 * The background job that moves contractors from "documents uploaded" to
 * "phone is ringing" without anyone watching a console.
 *
 * Twilio reviews bundles asynchronously and gives no reliable push for every
 * transition, so this polls. One pass does three jobs:
 *
 *   1. approved  → buy the number, attach it to the trunk, email them
 *   2. rejected  → store Twilio's reason in plain English for the dashboard
 *   3. expiring  → warn before `valid_until` lapses and kills a live number
 *
 * Designed to be safe to run every hour. Each client is handled independently;
 * one contractor's failure never stops the rest.
 */

import type { ClientUpdate, TwilioBundleStatus } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNumberLiveEmail } from "@/lib/email";
import { rc } from "./client";
import { parseEvaluation } from "./evaluation";
import { provisionNumber } from "./provisioning";

/** Warn this many days before an approved bundle expires. */
const RENEWAL_WARNING_DAYS = 30;

const IN_FLIGHT: TwilioBundleStatus[] = ["pending-review", "in-review", "draft"];

export type SyncReport = {
  checked: number;
  provisioned: string[];
  rejected: string[];
  expiringSoon: string[];
  errors: { clientId: string; message: string }[];
};

export async function syncBundles(): Promise<SyncReport> {
  const supabase = createAdminClient();
  const report: SyncReport = {
    checked: 0,
    provisioned: [],
    rejected: [],
    expiringSoon: [],
    errors: [],
  };

  const { data, error } = await supabase
    .from("clients")
    .select(
      "id,business_name,owner_name,email,twilio_bundle_sid,twilio_address_sid," +
        "twilio_bundle_status,assigned_phone_number,twilio_valid_until",
    )
    .not("twilio_bundle_sid", "is", null)
    .in("twilio_bundle_status", [...IN_FLIGHT, "twilio-approved", "provisionally-approved"]);

  if (error) throw new Error(`Could not read clients: ${error.message}`);

  type Pending = {
    id: string;
    business_name: string;
    owner_name: string;
    email: string;
    twilio_bundle_sid: string | null;
    twilio_address_sid: string | null;
    twilio_bundle_status: TwilioBundleStatus;
    assigned_phone_number: string | null;
    twilio_valid_until: string | null;
  };
  const clients = (data ?? []) as unknown as Pending[];

  for (const client of clients) {
    report.checked += 1;

    try {
      const bundle = await rc().bundles(client.twilio_bundle_sid!).fetch();
      const status = bundle.status as string;
      const validUntil = bundle.validUntil ? new Date(bundle.validUntil).toISOString() : null;

      const patch: ClientUpdate = {
        twilio_bundle_status: status as TwilioBundleStatus,
        twilio_valid_until: validUntil,
      };

      // ── rejected ────────────────────────────────────────────────
      if (status === "twilio-rejected") {
        // The bundle object does not carry the reason; the evaluation does.
        let reason = "Twilio rejected the documents but gave no reason.";
        try {
          const evaluations = await rc()
            .bundles(client.twilio_bundle_sid!)
            .evaluations.list({ limit: 1 });
          if (evaluations[0]) reason = parseEvaluation(evaluations[0]).summary;
        } catch {
          // Keep the generic reason rather than failing the whole pass.
        }
        patch.twilio_rejection_reason = reason;
        patch.onboarding_status = "documents_received";
        report.rejected.push(client.id);
      }

      // ── approved, no number yet → buy one ───────────────────────
      const approved = status === "twilio-approved" || status === "provisionally-approved";
      if (approved && !client.assigned_phone_number) {
        patch.twilio_rejection_reason = null;

        const result = await provisionNumber({
          id: client.id,
          business_name: client.business_name,
          twilio_bundle_sid: client.twilio_bundle_sid,
          twilio_address_sid: client.twilio_address_sid,
        });

        report.provisioned.push(`${client.business_name} → ${result.phoneNumber}`);

        await sendNumberLiveEmail({
          to: client.email,
          ownerName: client.owner_name,
          businessName: client.business_name,
          phoneNumber: result.phoneNumber,
          clientId: client.id,
        });

        // provisionNumber already wrote the number and onboarding_status.
        delete patch.onboarding_status;
      }

      // ── approaching expiry ──────────────────────────────────────
      if (approved && validUntil) {
        const daysLeft = Math.floor(
          (new Date(validUntil).getTime() - Date.now()) / 86_400_000,
        );
        if (daysLeft <= RENEWAL_WARNING_DAYS) {
          report.expiringSoon.push(
            `${client.business_name} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
          );
        }
      }

      await supabase.from("clients").update(patch).eq("id", client.id);
    } catch (cause) {
      report.errors.push({
        clientId: client.id,
        message: cause instanceof Error ? cause.message : "Unknown failure",
      });
    }
  }

  return report;
}
