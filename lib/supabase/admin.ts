import { createClient as createJsClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Service-role Supabase client — BYPASSES RLS.
 * SERVER-ONLY. Never import into Client Components.
 * Used by webhooks (Stripe, LiveKit) and provisioning logic.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createJsClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
