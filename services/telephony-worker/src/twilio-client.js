/**
 * Single shared Twilio client + the handful of URLs every module needs.
 * Kept in its own module so twilio-compliance.js and twilio-revalidation.js can
 * import it without forming a cycle.
 */
import twilio from 'twilio';

export const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/** Shorthand for the deeply-nested regulatory compliance namespace. */
export const rc = () => client.numbers.v2.regulatoryCompliance;

export const PUBLIC_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
export const STATUS_CALLBACK = `${PUBLIC_URL}/webhooks/twilio/compliance`;
export const VOICE_WEBHOOK =
  process.env.TWILIO_VOICE_WEBHOOK_URL || `${PUBLIC_URL}/webhooks/twilio/voice`;
