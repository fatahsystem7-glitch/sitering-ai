import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  isAdminProfile,
  requireAdmin,
  type AdminCustomerRow,
} from "@/lib/admin";
import { CustomersTable } from "@/components/admin/customers-table";

export const metadata: Metadata = { title: "Admin Customers" };

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await requireAdmin("/admin/customers");
  const supabase = createClient();

  const [{ data: profiles }, { data: telephony }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("telephony_provisioning").select("*"),
  ]);

  const telByUser = new Map((telephony ?? []).map((t) => [t.user_id, t]));

  const rows: AdminCustomerRow[] = (profiles ?? []).map((p) => {
    const t = telByUser.get(p.id);
    return {
      userId: p.id,
      businessName: p.business_name,
      ownerName: p.owner_name,
      tradeType: p.trade_type,
      assignedNumber: t?.assigned_phone_number ?? null,
      status: p.subscription_status,
      minutesUsed: t?.minutes_used_this_period ?? 0,
      minutesCap: t?.monthly_cap_minutes ?? 500,
      forwardingActive: t?.forwarding_active ?? true,
      isAdmin: isAdminProfile(p),
      createdAt: p.created_at,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} account{rows.length === 1 ? "" : "s"} · pause/resume
          answering or adjust minute allowances.
        </p>
      </div>
      <CustomersTable initial={rows} />
    </div>
  );
}
