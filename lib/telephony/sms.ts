import twilio from "twilio";
import { toE164 } from "@/lib/phone";

export function twilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !token) {
    throw new Error("Twilio is not configured.");
  }
  return twilio(sid, token);
}

export function bookingSmsBody(businessName: string, bookingUrl: string): string {
  const name = businessName.trim() || "Your contractor";
  return `${name}: book a visit here ${bookingUrl}\nReply STOP to opt out.`;
}

export async function sendBookingSms(input: {
  to: string;
  bookingUrl: string;
  businessName: string;
  fromNumber?: string | null;
}): Promise<{ sid: string }> {
  const to = toE164(input.to);
  if (!to) throw new Error("The caller number is not a valid mobile number.");
  if (!input.bookingUrl.trim()) throw new Error("No booking URL is configured.");

  const client = twilioClient();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const from = toE164(process.env.TWILIO_SMS_FROM) || toE164(input.fromNumber);
  if (!messagingServiceSid && !from) {
    throw new Error("Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_SMS_FROM before sending booking texts.");
  }

  const message = await client.messages.create({
    to,
    body: bookingSmsBody(input.businessName, input.bookingUrl.trim()),
    ...(messagingServiceSid ? { messagingServiceSid } : { from: from! }),
  });
  return { sid: message.sid };
}
