import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, SubscriptionStatus } from "@/lib/supabase/types";

/** Bootstrap admin account (also auto-flagged by migration 02 on signup). */
export const BOOTSTRAP_ADMIN = {
  name: "abdelfatah maghraoui",
  userId: "d79a90f4-e324-40fc-b942-3d71246c4f74",
} as const;

/** True when a profile belongs to SiteRing staff. */
export function isAdminProfile(
  profile: Pick<Profile, "is_admin" | "role"> | null | undefined,
): boolean {
  if (!profile) return false;
  return profile.is_admin === true || profile.role === "admin";
}

/**
 * Server-side admin guard — call at the top of every /admin route/action.
 * Redirects anonymous users to /login and non-admins to /dashboard.
 */
export async function requireAdmin(next = "/admin"): Promise<Profile> {
  const profile = await getAdminProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(next)}`);
  return profile;
}

/**
 * Non-redirecting admin guard for API route handlers. Returns the staff
 * profile, or null when the caller is anonymous or not staff — the route
 * then answers with its own 401/403 JSON. Never throws: a missing Supabase
 * configuration is treated as "not signed in" rather than a 500.
 */
export async function getAdminProfile(): Promise<Profile | null> {
  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch (cause) {
    console.error("[admin] Supabase is not configured — treating as signed out:", cause);
    return null;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!isAdminProfile(profile)) return null;
    return profile as Profile;
  } catch (cause) {
    console.error("[admin] Auth lookup failed — treating as signed out:", cause);
    return null;
  }
}

/** Flattened customer row for the admin customers table. */
export type AdminCustomerRow = {
  userId: string;
  businessName: string;
  ownerName: string | null;
  tradeType: string | null;
  assignedNumber: string | null;
  status: SubscriptionStatus;
  minutesUsed: number;
  minutesCap: number;
  forwardingActive: boolean;
  isAdmin: boolean;
  createdAt: string;
};

/** Aggregate platform metrics for the admin overview. */
export type AdminMetrics = {
  mrrPence: number;
  activeSubscribers: number;
  trialingSubscribers: number;
  totalCustomers: number;
  totalMinutesUsed: number;
  overageMinutes: number;
  overageRevenuePence: number;
};

export const MONTHLY_PRICE_PENCE = 15_000; // £150
export const OVERAGE_PENCE_PER_MINUTE = 10; // £0.10
