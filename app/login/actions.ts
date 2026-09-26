"use server";

import { findClientById, isUuid, setClientSession } from "@/lib/client-session";

export type LoginResult = { ok: true } | { ok: false; error: string };

/**
 * Logs a trade contractor into the single client dashboard using the
 * Client ID (UUID) issued at the end of the public onboarding form.
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

  setClientSession(client.id);
  return { ok: true };
}
