import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

/**
 * /reset-password — the landing page of the password-recovery link.
 * Supabase exchanged the recovery code for a session in /auth/callback;
 * this page is only reachable with that session (middleware + this check).
 */
export default async function ResetPasswordPage() {
  try {
    const {
      data: { user },
    } = await createClient().auth.getUser();
    if (!user) redirect("/login?next=/reset-password");
  } catch {
    redirect("/login?next=/reset-password");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[100px]" />
      <ResetPasswordForm />
    </div>
  );
}
