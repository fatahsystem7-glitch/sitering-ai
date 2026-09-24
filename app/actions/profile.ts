"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { normaliseProfileInput, profileInputSchema } from "@/lib/profile-schema";
import { toE164 } from "@/lib/phone";
import { ensureLivekitNumber, pointExistingNumber, purchaseUkNumber } from "@/lib/telephony/provision";

export type ActionResult = { ok: true; message?: string; phoneNumber?: string } | { ok: false; message: string };

export async function saveBusinessProfile(raw: unknown): Promise<ActionResult> {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) return { ok: false, message: "Sign in again to save this profile." };

  const parsed = profileInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  let input;
  try {
    input = normaliseProfileInput(parsed.data);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Check the web addresses." };
  }

  const payload = {
    user_id: user.id,
    business_name: input.business_name,
    trade_type: input.trade_type,
    service_areas: input.service_areas,
    callout_fee: input.callout_fee || null,
    operating_hours: input.operating_hours || null,
    website_url: input.website_url || null,
    booking_url: input.booking_url || null,
    custom_instructions: input.custom_instructions || null,
    services: input.services,
  };

  const { error } = await supabase.from("business_profiles").upsert(payload, { onConflict: "user_id" });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/onboarding");
  return { ok: true, message: "Saved. The next call will use this profile." };
}

export async function provisionPhoneNumber(): Promise<ActionResult> {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) return { ok: false, message: "Sign in again to assign a number." };

  const { data: existing } = await supabase
    .from("business_profiles")
    .select("id, phone_number, business_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) return { ok: false, message: "Save the business profile before assigning a number." };
  if (existing.phone_number) {
    return { ok: true, phoneNumber: existing.phone_number, message: "A number is already assigned." };
  }

  try {
    const phoneNumber = await purchaseUkNumber();
    const registration = await ensureLivekitNumber(phoneNumber);
    const { error } = await supabase
      .from("business_profiles")
      .update({
        phone_number: phoneNumber,
        provisioning_status: "active",
        provisioning_error: null,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
    return {
      ok: true,
      phoneNumber,
      message: `Assigned ${phoneNumber}. LiveKit trunk ${registration.trunkId}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Number purchase failed.";
    await supabase
      .from("business_profiles")
      .update({ provisioning_status: "failed", provisioning_error: message })
      .eq("user_id", user.id);
    return { ok: false, message };
  }
}

export async function registerExistingNumber(rawNumber: string): Promise<ActionResult> {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) return { ok: false, message: "Sign in again to register a number." };
  const phoneNumber = toE164(rawNumber);
  if (!phoneNumber || !phoneNumber.startsWith("+44")) {
    return { ok: false, message: "Enter a UK number, for example 07… or +44…" };
  }

  try {
    await pointExistingNumber(phoneNumber);
    await ensureLivekitNumber(phoneNumber);
    const { error } = await supabase.from("business_profiles").upsert(
      {
        user_id: user.id,
        phone_number: phoneNumber,
        provisioning_status: "active",
        provisioning_error: null,
      },
      { onConflict: "user_id" },
    );
    if (error) return { ok: false, message: error.message };
    revalidatePath("/dashboard");
    return { ok: true, phoneNumber, message: "Number registered with Twilio and LiveKit." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not register that number." };
  }
}
