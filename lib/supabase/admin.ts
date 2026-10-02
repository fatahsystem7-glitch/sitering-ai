import { createClient as createJsClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Service-role Supabase client — BYPASSES RLS.
 * SERVER-ONLY. Never import into Client Components.
 * Used by webhooks (Stripe, LiveKit) and provisioning logic.
 */
export function createAdminClient() {
  // requireEnv throws an error naming exactly which variable is missing,
  // instead of a generic failure from deep inside supabase-js.
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createJsClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
