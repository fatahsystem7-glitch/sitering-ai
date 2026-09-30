import crypto from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/supabase/types";

/**
 * Dashboard sessions
 * ──────────────────
 * Two logins resolve to the same `Client` row, and `getCurrentClient()` is
 * the single entry point for both:
 *
 *  1. Supabase Auth (email + password) — accounts created since migration 08.
 *     Resolved by `clients.owner_auth_user_id = auth.uid()`.
 *  2. Client ID (this file's signed cookie) — legacy accounts, unchanged.
 *     Their rows have no `owner_auth_user_id`, so the cookie is the only
 *     credential they have and it keeps working.
 *
 * The UUID is never trusted straight from the cookie: we store
 * `<clientId>.<expiry>.<hmac>` signed with a server-only secret, so the cookie
 * cannot be forged by guessing/brute-forcing UUIDs client-side.
 */

export const CLIENT_SESSION_COOKIE = "sitering_client";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function sessionSecret(): string {
  const secret =
    process.env.CLIENT_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VOICE_WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CLIENT_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be set to sign dashboard sessions.",
      );
    }
    return "sitering-dev-only-insecure-secret";
  }
  return secret;
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
}

function serialize(clientId: string): string {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${clientId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

function deserialize(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [clientId, expiresRaw, signature] = parts;
  const payload = `${clientId}.${expiresRaw}`;
  const expected = sign(payload);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return null;
  if (!isUuid(clientId)) return null;

  return clientId;
}

/** Issue the signed session cookie for a verified Client ID. */
export function setClientSession(clientId: string): void {
  cookies().set(CLIENT_SESSION_COOKIE, serialize(clientId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearClientSession(): void {
  cookies().set(CLIENT_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Retire a Client-ID cookie left over from a previous sign-in.
 *
 * Called after an email + password sign-in so a stale legacy cookie can't
 * outlive the session it belonged to (and so /login doesn't bounce the user
 * straight back into the dashboard on the cookie alone).
 */
export function clearLegacyClientCookie(): void {
  clearClientSession();
}

/** The Client ID in the current request's cookie, or null. */
export function getClientIdFromCookie(): string | null {
  const token = cookies().get(CLIENT_SESSION_COOKIE)?.value;
  if (!token) return null;
  return deserialize(token);
}

/** Verify a raw Client ID against Supabase. Returns the client row or null. */
export async function findClientById(clientId: string): Promise<Client | null> {
  if (!isUuid(clientId)) return null;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId.trim().toLowerCase())
      .maybeSingle();

    if (error || !data) return null;
    return data as Client;
  } catch (err) {
    console.error("[client-session] Supabase lookup failed:", err);
    return null;
  }
}

/** Resolve the account owned by a Supabase Auth user, or null. */
export async function findClientByAuthUserId(userId: string): Promise<Client | null> {
  if (!userId) return null;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("owner_auth_user_id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return data as Client;
  } catch (err) {
    console.error("[client-session] Auth-user lookup failed:", err);
    return null;
  }
}

/**
 * The signed-in client for the current request, or null.
 *
 * The email + password session is checked first; the Client-ID cookie is the
 * fallback, so both kinds of account reach the same dashboard.
 */
export async function getCurrentClient(): Promise<Client | null> {
  const cookieClientId = getClientIdFromCookie();

  try {
    const {
      data: { user },
    } = await createClient().auth.getUser();

    if (user) {
      const byAuthUser = await findClientByAuthUserId(user.id);
      // An auth user without a client row (a staff account, say) falls
      // through to the cookie rather than returning null, so having a stale
      // Supabase session can never lock a legacy login out of its dashboard.
      if (byAuthUser) return byAuthUser;
    }
  } catch (err) {
    console.error("[client-session] Auth session lookup failed:", err);
  }

  if (!cookieClientId) return null;
  return findClientById(cookieClientId);
}
