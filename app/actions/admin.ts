"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, isAdminUser } from "@/lib/auth";
import { toE164 } from "@/lib/phone";

export async function saveDemoPhone(raw: string): Promise<{ ok: boolean; message: string }> {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user || !(await isAdminUser(user))) {
    return { ok: false, message: "Admin access required." };
  }
  const trimmed = raw.trim();
  const value = trimmed ? toE164(trimmed) ?? trimmed : "";
  const { error } = await supabase.from("app_settings").upsert(
    { key: "demo_phone_number", value },
    { onConflict: "key" },
  );
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true, message: value ? "Demo number updated." : "Demo number cleared. The env value will be used." };
}

export async function setAccountStatus(
  profileId: string,
  status: "trial" | "active" | "suspended",
): Promise<{ ok: boolean; message: string }> {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user || !(await isAdminUser(user))) {
    return { ok: false, message: "Admin access required." };
  }
  const { error } = await supabase
    .from("business_profiles")
    .update({ subscription_status: status })
    .eq("id", profileId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin");
  return { ok: true, message: "Account updated." };
}
