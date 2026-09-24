import { redirect } from "next/navigation";
import { BusinessProfileForm, type ProfileFormState } from "@/components/business-profile-form";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { loadOwnProfile } from "@/lib/load-profile";
import { EMPTY_SERVICE } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const { user } = await getSessionUser();
  if (!user) redirect("/login?next=/onboarding");
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
    <>
      <SiteHeader signedIn />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass-deep">Business profile</p>
        <h1 className="serif mt-3 text-4xl">What should the receptionist know?</h1>
        <p className="mt-3 text-muted">
          This is saved to your business profile and injected into the call the moment someone dials your number.
        </p>
        <div className="mt-8 rounded-3xl border border-line bg-card p-6 md:p-8">
          <BusinessProfileForm initial={initial} submitLabel="Save and continue" nextHref="/dashboard/settings" />
        </div>
      </main>
    </>
  );
}
