import { getSessionUser } from "@/lib/auth";
import { londonPeriod } from "@/lib/period";
import { asServices, type BusinessProfile, type CallLog, type CallbackRequest } from "@/lib/types";

export async function loadOwnProfile(): Promise<BusinessProfile | null> {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) return null;
  const { data } = await supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (!data) return null;
  return {
    ...data,
    services: asServices(data.services),
    used_minutes: data.minutes_period && data.minutes_period !== londonPeriod() ? 0 : Number(data.used_minutes ?? 0),
  } as BusinessProfile;
}

export async function loadOwnCalls(): Promise<CallLog[]> {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) return [];
  const profile = await loadOwnProfile();
  if (!profile) return [];
  const { data } = await supabase
    .from("call_logs")
    .select("*")
    .eq("business_profile_id", profile.id)
    .order("started_at", { ascending: false })
    .limit(50);
  return (data ?? []) as CallLog[];
}

export async function loadOwnCallbacks(): Promise<CallbackRequest[]> {
  const { supabase } = await getSessionUser();
  const profile = await loadOwnProfile();
  if (!supabase || !profile) return [];
  const { data } = await supabase
    .from("callback_requests")
    .select("*")
    .eq("business_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as CallbackRequest[];
}
