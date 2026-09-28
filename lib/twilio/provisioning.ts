/**
 * Buying the UK number, once Twilio has approved the contractor's bundle.
 *
 * A GB local number cannot be purchased without an approved bundle SID and an
 * address SID, so this only ever runs after the compliance step has passed.
 *
 * Routing matters as much as the purchase: calls reach the receptionist via
 * Twilio SIP trunk → LiveKit. A number that is bought but not attached to the
 * trunk rings into silence, which looks exactly like a broken product to the
 * contractor's customer. So the trunk is checked BEFORE any money is spent.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { twilio } from "./client";

export type ProvisionResult = {
  phoneNumber: string;
  phoneNumberSid: string;
};

export type ProvisionInput = {
  id: string;
  business_name: string;
  twilio_bundle_sid: string | null;
  twilio_address_sid: string | null;
  /** Optional UK area code preference, e.g. "20" for London, "161" Manchester. */
  area_code?: string | null;
};

function trunkSid(): string {
  const sid = process.env.TWILIO_SIP_TRUNK_SID;
  if (!sid) {
    throw new Error(
      "TWILIO_SIP_TRUNK_SID is not set. Numbers must join the SIP trunk that " +
        "routes to LiveKit, otherwise inbound calls go nowhere. Refusing to buy a number.",
    );
  }
  return sid;
}

export async function provisionNumber(client: ProvisionInput): Promise<ProvisionResult> {
  if (!client.twilio_bundle_sid || !client.twilio_address_sid) {
    throw new Error("Cannot buy a UK number before the regulatory bundle is approved.");
  }

  const trunk = trunkSid(); // throws before spending anything
  const api = twilio();

  const available = await api
    .availablePhoneNumbers("GB")
    .local.list({
      voiceEnabled: true,
      smsEnabled: true,
      limit: 5,
      ...(client.area_code ? { areaCode: Number(client.area_code) } : {}),
    });

  if (available.length === 0) {
    throw new Error(
      client.area_code
        ? `No UK numbers available in area code ${client.area_code}. Try without a preference.`
        : "Twilio has no UK local numbers available right now.",
    );
  }

  const purchased = await api.incomingPhoneNumbers.create({
    phoneNumber: available[0].phoneNumber,
    friendlyName: `${client.business_name} (SiteRing)`,
    bundleSid: client.twilio_bundle_sid,
    addressSid: client.twilio_address_sid,
  });

  // Route it into LiveKit. If this fails the number exists but is deaf, so the
  // error is deliberately loud rather than swallowed.
  await api.trunking.v1.trunks(trunk).phoneNumbers.create({
    phoneNumberSid: purchased.sid,
  });

  const supabase = createAdminClient();
  await supabase
    .from("clients")
    .update({
      assigned_phone_number: purchased.phoneNumber,
      twilio_phone_number_sid: purchased.sid,
      onboarding_status: "live",
    })
    .eq("id", client.id);

  return { phoneNumber: purchased.phoneNumber, phoneNumberSid: purchased.sid };
}
