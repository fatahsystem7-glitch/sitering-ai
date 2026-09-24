import { createAdminClient } from "@/lib/supabase/admin";
import { readEnv } from "@/lib/env";

export async function getDemoPhoneNumber(): Promise<string | null> {
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "demo_phone_number")
      .maybeSingle();
    const fromDb = typeof data?.value === "string" ? data.value.trim() : "";
    if (fromDb) return fromDb;
  }
  const fromEnv = readEnv("NEXT_PUBLIC_DEMO_PHONE_NUMBER");
  return fromEnv || null;
}
