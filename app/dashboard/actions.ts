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
