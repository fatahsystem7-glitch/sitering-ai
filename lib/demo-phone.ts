import { createClient } from "@/lib/supabase/server";
import { DEMO_CALL_NUMBER } from "@/lib/site";

export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

/** Env first, then app_settings.demo_phone_number when Supabase is configured. */
export async function getDemoPhoneNumber(): Promise<string> {
  const fromEnv =
    process.env.NEXT_PUBLIC_DEMO_PHONE_NUMBER?.trim() ||
    process.env.NEXT_PUBLIC_DEMO_CALL_NUMBER?.trim() ||
    DEMO_CALL_NUMBER;

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return fromEnv;
  }

  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "demo_phone_number")
      .maybeSingle();
    const fromDb = data?.value?.trim();
    return fromDb || fromEnv;
  } catch {
    return fromEnv;
  }
}
