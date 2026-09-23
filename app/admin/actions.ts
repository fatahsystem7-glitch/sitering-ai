"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

/** Pause (false) or resume (true) AI answering for a subscriber account. */
export async function setAccountForwarding(
  userId: string,
  active: boolean,
): Promise<AdminActionResult> {
  await requireAdmin("/admin/customers");

  const supabase = createClient();
  const { error } = await supabase
    .from("telephony_provisioning")
    .update({ forwarding_active: active })
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/customers");
  return { ok: true };
}

/** Adjust a subscriber's monthly minute allowance. */
export async function setMinuteCap(
  userId: string,
  cap: number,
): Promise<AdminActionResult> {
  await requireAdmin("/admin/customers");

  if (!Number.isInteger(cap) || cap < 0 || cap > 100_000) {
    return {
      ok: false,
      error: "Cap must be a whole number between 0 and 100,000.",
    };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("telephony_provisioning")
    .update({ monthly_cap_minutes: cap })
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/customers");
  return { ok: true };
}
