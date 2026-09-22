import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard");

  const [{ data: profile }, { data: telephony }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("telephony_provisioning")
      .select("*")
      .eq("user_id", user.id)
      .single(),
  ]);

  if (!profile) redirect("/login?next=/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader profile={profile} telephony={telephony} />
      <main className="container py-8">{children}</main>
    </div>
  );
}
