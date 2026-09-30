import type { Metadata } from "next";
import OnboardingPage from "@/app/onboarding/page";

/**
 * Registration — the same 5-step onboarding wizard as /onboarding:
 * business details, account owner, address, receptionist setup, and the
 * Twilio verification that buys the contractor their phone number.
 *
 * /signup and /onboarding are deliberately the same screen; /login is the
 * separate, single-purpose entry for existing accounts.
 */
export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Sign up for SiteRing AI — set up your AI receptionist and get your dedicated UK phone number.",
};

export default function SignupPage() {
  return <OnboardingPage />;
}
