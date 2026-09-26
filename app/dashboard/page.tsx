import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentClient } from "@/lib/client-session";
import { ClientDashboard } from "@/components/dashboard/client-dashboard";
import type { CallLog, MessageLog } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * The single, unified client dashboard.
 * Authenticated by the signed Client-ID (UUID) session cookie — call logs,
 * message transcripts and account settings all live here.
 */
export default async function DashboardPage() {
  const client = await getCurrentClient();
  if (!client) redirect("/login?next=/dashboard");

  let calls: CallLog[] = [];
  let messages: MessageLog[] = [];

  try {
    const supabase = createAdminClient();
    const [{ data: callRows }, { data: messageRows }] = await Promise.all([
      supabase
        .from("call_logs")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("message_logs")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    calls = (callRows ?? []) as CallLog[];
    messages = (messageRows ?? []) as MessageLog[];
  } catch (err) {
    console.error("[dashboard] Failed to load activity:", err);
  }

  return <ClientDashboard client={client} calls={calls} messages={messages} />;
}
