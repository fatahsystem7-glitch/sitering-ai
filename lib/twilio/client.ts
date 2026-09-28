import Twilio from "twilio";

/**
 * Lazy Twilio client. Constructed on demand rather than at module load so
 * that importing anything from `lib/twilio` during a build — where the
 * credentials are deliberately absent — does not throw.
 */
let cached: ReturnType<typeof Twilio> | null = null;

export function twilio() {
  if (cached) return cached;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).");
  }

  cached = Twilio(sid, token);
  return cached;
}

/** Shorthand for the Regulatory Compliance namespace, which is deeply nested. */
export function rc() {
  return twilio().numbers.v2.regulatoryCompliance;
}

export const twilioConfigured = () =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
