"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clearLegacyClientCookie,
  findClientById,
  isUuid,
  setClientSession,
} from "@/lib/client-session";

export type LoginResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

const DEFAULT_DESTINATION = "/dashboard";

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(200),
  password: z.string().min(1, "Enter your password.").max(72),
});

/** Only same-origin paths are honoured, so `?next=` can't be an open redirect. */
function safeNext(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : DEFAULT_DESTINATION;
}

/** True when the signed-in user is SiteRing staff (admin area). */
async function isStaffUser(userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, role")
      .eq("id", userId)
      .maybeSingle();
    return profile?.is_admin === true || profile?.role === "admin";
  } catch {
    return false;
  }
}

/**
 * Signs a user in with the Supabase Auth email + password credentials they
 * chose at signup. Staff land in /admin, contractors in /dashboard.
 */
export async function signIn(formData: FormData): Promise<LoginResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { ok: false, error: first ?? "Please check your details and try again." };
  }

  const next = safeNext(formData.get("next"));

  let userId: string | null = null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      // Deliberately vague — never reveal whether the email exists.
      return { ok: false, error: "Invalid email or password." };
    }
    userId = data.user.id;
  } catch (cause) {
    console.error("[login] Sign-in failed:", cause);
    return {
      ok: false,
      error: "We couldn't sign you in right now. Please try again in a moment.",
    };
  }

  // Retire any stale Client-ID cookie left by the older login method.
  clearLegacyClientCookie();

  const redirectTo =
    next !== DEFAULT_DESTINATION
      ? next
      : (await isStaffUser(userId))
        ? "/admin"
        : next;
  return { ok: true, redirectTo };
}

/**
 * Legacy sign-in: the Client ID (UUID) issued on the onboarding form before
 * email + password login existed.
 *
 * Kept deliberately — accounts created back then have no Supabase Auth user,
 * so this cookie is their only way into the dashboard. Removing it would lock
 * every existing contractor out of their own account.
 */
export async function loginWithClientId(rawId: string): Promise<LoginResult> {
  const clientId = rawId.trim().toLowerCase();

  if (!clientId) {
    return { ok: false, error: "Please enter your Client ID." };
  }
  if (!isUuid(clientId)) {
    return {
      ok: false,
      error:
        "That doesn't look like a Client ID. It's a 36-character code, e.g. 3f2b8c10-9e7a-4a51-8d0e-6c1b2a9f4d33.",
    };
  }

  const client = await findClientById(clientId);
  if (!client) {
    return {
      ok: false,
      error:
        "We couldn't find an account with that Client ID. Check it and try again, or contact support.",
    };
  }

  // Accounts created since email login have a password, so their Client ID is
  // a reference rather than a credential — it gets emailed, screenshotted and
  // quoted to support, and so must not grant access on its own.
  if (client.owner_auth_user_id) {
    return {
      ok: false,
      error:
        "This account signs in with its email and password. Use the email login above — or reset your password if you've forgotten it.",
    };
  }

  setClientSession(client.id);
  return { ok: true, redirectTo: DEFAULT_DESTINATION };
}

export type ResetRequestResult = { ok: true } | { ok: false; error: string };

/**
 * Sends the Supabase password-reset email for an address.
 *
 * Accounts that predate email login have no Supabase Auth user, so no reset
 * mail can exist for them. Rather than promising an email that will never
 * arrive, those contractors are told to use their Client ID.
 */
export async function requestPasswordReset(
  formData: FormData,
): Promise<ResetRequestResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!z.string().email().max(200).safeParse(email).success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  try {
    const admin = createAdminClient();
    const { data: legacy } = await admin
      .from("clients")
      .select("id,owner_auth_user_id")
      .ilike("email", email)
      .maybeSingle();

    if (legacy && !legacy.owner_auth_user_id) {
      return {
        ok: false,
        error:
          "This account signs in with a Client ID rather than a password. Log in with your Client ID, or email support@sitering.ai and we'll help you back in.",
      };
    }
  } catch (cause) {
    // Never block a real reset because the legacy lookup had a hiccup.
    console.warn("[login] Legacy-account check failed:", cause);
  }

  try {
    const origin = originFromHeaders();
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      console.error("[login] Reset request failed:", error.message);
      return { ok: false, error: "We couldn't send that email right now. Please try again." };
    }
    return { ok: true };
  } catch (cause) {
    console.error("[login] Reset request failed:", cause);
    return { ok: false, error: "We couldn't send that email right now. Please try again." };
  }
}

/** Public origin of this deployment, honouring reverse proxies (Vercel). */
function originFromHeaders(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const store = headers();
  const forwardedHost = store.get("x-forwarded-host") ?? store.get("host");
  const proto = store.get("x-forwarded-proto") ?? "https";
  return forwardedHost ? `${proto}://${forwardedHost}` : "http://localhost:3000";
}
