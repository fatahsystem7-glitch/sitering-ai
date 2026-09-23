import { isAdminProfile, requireAdmin } from "@/lib/admin";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminGate } from "@/components/admin/admin-gate";

/**
 * Server-side gate: anonymous users → /login, non-admins → /dashboard.
 * Client-side <AdminGate> adds defence-in-depth below.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader adminName={profile.owner_name || profile.business_name} />
      <AdminGate isAdmin={isAdminProfile(profile)}>
        <main className="container py-8">{children}</main>
      </AdminGate>
    </div>
  );
}
