import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReceptionProfileForm } from "@/components/dashboard/reception-profile-form";
import { Button } from "@/components/ui/button";
import type { BusinessProfile } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Set up your receptionist" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/onboarding");

  const { data: reception } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Receptionist setup</h1>
        <p className="text-sm text-muted-foreground">
          Same profile used in Settings. The next inbound call reads these
          services, areas and the booking link. Nothing is invented.
        </p>
      </div>
      <ReceptionProfileForm profile={(reception as BusinessProfile | null) ?? null} />
      <Button variant="outline" asChild>
        <Link href="/dashboard">Continue to dashboard</Link>
      </Button>
    </div>
  );
}
