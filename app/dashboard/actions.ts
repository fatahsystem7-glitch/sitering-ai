"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clearClientSession, getClientIdFromCookie } from "@/lib/client-session";
import type { ClientUpdate } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

/* ─── Sign out (clears the Client-ID session and any admin session) ─── */

export async function signOut(): Promise<void> {
  clearClientSession();
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    /* no Supabase auth session — Client-ID logins don't have one */
  }
  redirect("/login");
}

/* ─── Update account settings from the unified dashboard ───────────── */

const settingsSchema = z.object({
  business_name: z.string().trim().min(2, "Business name is required").max(200),
  owner_name: z.string().trim().min(2, "Your name is required").max(200),
  trade_type: z.string().trim().max(100).optional().or(z.literal("")),
  email: z.string().trim().email("A valid email is required").max(200),
  phone_number: z.string().trim().max(50).optional().or(z.literal("")),
  emergency_forwarding_number: z.string().trim().max(50).optional().or(z.literal("")),
  service_areas: z.string().trim().max(500).optional().or(z.literal("")),
  operating_hours: z.string().trim().max(200).optional().or(z.literal("")),
  callout_fee: z.string().trim().max(100).optional().or(z.literal("")),
  greeting_style: z.string().trim().max(100).optional().or(z.literal("")),
  custom_instructions: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function updateAccountSettings(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const clientId = getClientIdFromCookie();
  if (!clientId) return { ok: false, error: "Your session expired. Please log in again." };

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { ok: false, error: first ?? "Please check the form and try again." };
  }
  const d = parsed.data;

  const update: ClientUpdate = {
    business_name: d.business_name,
    owner_name: d.owner_name,
    trade_type: d.trade_type || null,
    email: d.email.toLowerCase(),
    phone_number: d.phone_number || null,
    emergency_forwarding_number: d.emergency_forwarding_number || "",
    service_areas: d.service_areas || null,
    operating_hours: d.operating_hours || null,
    callout_fee: d.callout_fee || null,
    greeting_style: d.greeting_style || null,
    custom_instructions: d.custom_instructions || null,
  };

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("clients").update(update).eq("id", clientId);
    if (error) throw error;
  } catch (err) {
    console.error("[dashboard] Failed to update settings:", err);
    return { ok: false, error: "We couldn't save your changes. Please try again." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
