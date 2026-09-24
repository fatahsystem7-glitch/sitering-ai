"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/* ─── Sign out ─────────────────────────────────────────────── */

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/* ─── Update business details ─────────────────────────────── */

const businessDetailsSchema = z.object({
  business_name: z.string().trim().min(1, "Business name is required").max(120),
  owner_name: z.string().trim().max(120).optional().or(z.literal("")),
  phone_number: z.string().trim().max(40).optional().or(z.literal("")),
  trade_type: z.string().trim().max(60).optional().or(z.literal("")),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateBusinessDetails(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = businessDetailsSchema.safeParse({
    business_name: formData.get("business_name"),
    owner_name: formData.get("owner_name"),
    phone_number: formData.get("phone_number"),
    trade_type: formData.get("trade_type"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("profiles")
    .update({
      business_name: parsed.data.business_name,
      owner_name: parsed.data.owner_name || null,
      phone_number: parsed.data.phone_number || null,
      trade_type: parsed.data.trade_type || null,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/* ─── Update emergency forwarding number ──────────────────── */

const emergencySchema = z.object({
  emergency_forwarding_number: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number.")
    .max(40),
});

export async function updateEmergencyNumber(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = emergencySchema.safeParse({
    emergency_forwarding_number: formData.get("emergency_forwarding_number"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("profiles")
    .update({
      emergency_forwarding_number: parsed.data.emergency_forwarding_number,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/* ─── Toggle call forwarding on/off ───────────────────────── */

export async function toggleForwarding(active: boolean): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("telephony_provisioning")
    .update({ forwarding_active: active })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

const receptionSchema = z.object({
  service_areas: z.string().trim().max(500).optional().or(z.literal("")),
  callout_fee: z.string().trim().max(200).optional().or(z.literal("")),
  operating_hours: z.string().trim().max(300).optional().or(z.literal("")),
  website_url: z.string().trim().max(500).optional().or(z.literal("")),
  booking_url: z.string().trim().max(500).optional().or(z.literal("")),
  custom_instructions: z.string().trim().max(4000).optional().or(z.literal("")),
  services: z.string().max(20_000),
});

function parseServices(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false as const, error: "Services could not be read." };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false as const, error: "Services must be a list." };
  }
  const services = parsed
    .map((item) => {
      const row = item as { name?: unknown; price?: unknown; duration?: unknown };
      return {
        name: String(row.name ?? "").trim().slice(0, 120),
        price: String(row.price ?? "").trim().slice(0, 80),
        duration: String(row.duration ?? "").trim().slice(0, 80),
      };
    })
    .filter((item) => item.name);
  return { ok: true as const, services };
}

export async function saveReceptionProfile(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = receptionSchema.safeParse({
    service_areas: formData.get("service_areas"),
    callout_fee: formData.get("callout_fee"),
    operating_hours: formData.get("operating_hours"),
    website_url: formData.get("website_url"),
    booking_url: formData.get("booking_url"),
    custom_instructions: formData.get("custom_instructions"),
    services: formData.get("services") ?? "[]",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const services = parseServices(parsed.data.services);
  if (!services.ok) return services;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const [{ data: profile }, { data: telephony }] = await Promise.all([
    supabase
      .from("profiles")
      .select("business_name, trade_type")
      .eq("id", user.id)
      .single(),
    supabase
      .from("telephony_provisioning")
      .select("assigned_phone_number")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const { error } = await supabase.from("business_profiles").upsert(
    {
      user_id: user.id,
      business_name: profile?.business_name ?? null,
      trade_type: profile?.trade_type ?? null,
      phone_number: telephony?.assigned_phone_number ?? null,
      service_areas: parsed.data.service_areas || null,
      callout_fee: parsed.data.callout_fee || null,
      operating_hours: parsed.data.operating_hours || null,
      website_url: parsed.data.website_url || null,
      booking_url: parsed.data.booking_url || null,
      custom_instructions: parsed.data.custom_instructions || null,
      services: services.services,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/onboarding");
  return { ok: true };
}
