import { redirect } from "next/navigation";
import { BusinessProfileForm, type ProfileFormState } from "@/components/business-profile-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { NumberTools } from "@/components/number-tools";
import { TestSms } from "@/components/test-sms";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSessionUser } from "@/lib/auth";
import { loadOwnProfile } from "@/lib/load-profile";
import { EMPTY_SERVICE } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user } = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard/settings");
  const profile = await loadOwnProfile();
  const initial: ProfileFormState = {
    business_name: profile?.business_name ?? "",
    trade_type: profile?.trade_type ?? "",
    service_areas: profile?.service_areas ?? "",
    callout_fee: profile?.callout_fee ?? "",
    operating_hours: profile?.operating_hours ?? "",
    website_url: profile?.website_url ?? "",
    booking_url: profile?.booking_url ?? "",
    custom_instructions: profile?.custom_instructions ?? "",
    services: profile?.services?.length ? profile.services : [{ ...EMPTY_SERVICE }],
  };

  return (
    <DashboardShell businessName={profile?.business_name} phoneNumber={profile?.phone_number} email={user.email}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="serif text-4xl">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Changes are stored on the business profile and read on the next inbound call. The theme toggle is in the header as well.
          </p>
        </div>
        <ThemeToggle />
      </div>
      <div className="mt-8 space-y-6">
        <NumberTools phoneNumber={profile?.phone_number ?? null} />
        <TestSms bookingUrl={profile?.booking_url ?? null} />
        {profile?.provisioning_error ? (
          <p className="rounded-2xl border border-signal/40 bg-card px-4 py-3 text-sm text-signal">{profile.provisioning_error}</p>
        ) : null}
        <section className="rounded-3xl border border-line bg-card p-6 md:p-8">
          <h2 className="serif text-2xl">Business profile</h2>
          <div className="mt-6">
            <BusinessProfileForm initial={initial} />
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
