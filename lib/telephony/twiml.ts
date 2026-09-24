import { appOrigin } from "@/lib/env";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function livekitSipHost(): string | null {
  const explicit = process.env.LIVEKIT_SIP_HOST?.trim();
  if (explicit) {
    return explicit.replace(/^sips?:/i, "").replace(/\/$/, "");
  }
  const raw = process.env.LIVEKIT_URL?.trim();
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname;
    if (host.endsWith(".livekit.cloud")) {
      return host.replace(".livekit.cloud", ".sip.livekit.cloud");
    }
    return host;
  } catch {
    return null;
  }
}

export function voiceTwiml(dialedNumber: string): string {
  const host = livekitSipHost();
  if (!host) {
    return sayTwiml("This line is not connected to the receptionist yet. Please try again shortly.");
  }
  const user = dialedNumber.replace(/[^\d+]/g, "") || "sitering";
  const username = process.env.LIVEKIT_SIP_USERNAME?.trim();
  const password = process.env.LIVEKIT_SIP_PASSWORD?.trim();
  const transport = (process.env.LIVEKIT_SIP_TRANSPORT?.trim() || "tls").replace(/[^a-z0-9]/gi, "");
  const auth =
    username && password
      ? ` username="${xmlEscape(username)}" password="${xmlEscape(password)}"`
      : "";
  const status = appOrigin()
    ? ` statusCallback="${xmlEscape(`${appOrigin()}/api/twilio/status`)}" statusCallbackMethod="POST" statusCallbackEvent="completed"`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true" timeout="25"${status}>
    <Sip${auth}>sip:${xmlEscape(user)}@${xmlEscape(host)};transport=${xmlEscape(transport)}</Sip>
  </Dial>
</Response>`;
}

export function sayTwiml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy" language="en-GB">${xmlEscape(message)}</Say>
  <Hangup/>
</Response>`;
}
