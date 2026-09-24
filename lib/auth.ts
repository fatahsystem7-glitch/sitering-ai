import { safeNextPath } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export { safeNextPath };

export async function getSessionUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdminUser(user: { id: string; email?: string | null }): Promise<boolean> {
  if (user.email && adminEmails().includes(user.email.toLowerCase())) return true;
  const { supabase } = await getSessionUser();
  if (!supabase) return false;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return data?.role === "admin";
}
