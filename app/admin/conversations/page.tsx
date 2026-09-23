import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import {
  ConversationsExplorer,
  type BusinessDirectory,
} from "@/components/admin/conversations-explorer";

export const metadata: Metadata = { title: "Admin Conversations" };

export const dynamic = "force-dynamic";

export default async function AdminConversationsPage() {
  await requireAdmin("/admin/conversations");
  const supabase = createClient();

  const [{ data: calls }, { data: profiles }] = await Promise.all([
    supabase
      .from("call_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("profiles").select("id, business_name, trade_type"),
  ]);

  const directory: BusinessDirectory = Object.fromEntries(
    (profiles ?? []).map((p) => [
      p.id,
      { business: p.business_name, trade: p.trade_type },
    ]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
        <p className="text-sm text-muted-foreground">
          Every subscriber call — transcripts, AI summaries, recordings and
          caller history.
        </p>
      </div>
      <ConversationsExplorer calls={calls ?? []} directory={directory} />
    </div>
  );
}
