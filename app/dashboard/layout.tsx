import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/client-session";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const client = await getCurrentClient();
  if (!client) redirect("/login?next=/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader client={client} />
      <main className="container py-8">{children}</main>
    </div>
  );
}
