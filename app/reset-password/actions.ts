"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type PasswordUpdateResult = { ok: true } | { ok: false; error: string };

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.");

/**
 * Sets a new password for the signed-in user. Reached from the recovery
 * link: /auth/callback exchanges the code for a session, then lands here.
 */
export async function updatePassword(formData: FormData): Promise<PasswordUpdateResult> {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }

  if (parsed.data !== String(formData.get("confirm") ?? "")) {
    return { ok: false, error: "The two passwords don't match." };
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data });

    if (error) {
      console.error("[reset-password] Update failed:", error.message);
      return {
        ok: false,
        error:
          "We couldn't update your password — the reset link may have expired. Send yourself a new one.",
      };
    }
  } catch (cause) {
    console.error("[reset-password] Update failed:", cause);
    return { ok: false, error: "We couldn't update your password right now. Please try again." };
  }

  redirect("/dashboard");
}
