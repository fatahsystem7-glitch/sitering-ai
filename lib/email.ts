/**
 * Transactional email (Resend).
 *
 * Fully optional: if `RESEND_API_KEY` isn't set we log and no-op so the
 * onboarding flow never fails because of email. The onboarding API reports
 * whether the email actually went out, and the UI adapts its wording.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function fromAddress(): string {
  return process.env.EMAIL_FROM || "SiteRing AI <onboarding@sitering.ai>";
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

async function send({ to, subject, html, text, replyTo }: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping send:", subject);
    return false;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!res.ok) {
      console.error("[email] Resend rejected the send:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Send failed:", err);
    return false;
  }
}

/** Sends the contractor their Client ID — their only dashboard credential. */
export async function sendClientIdEmail(args: {
  to: string;
  ownerName: string;
  businessName: string;
  clientId: string;
}): Promise<boolean> {
  const { to, ownerName, businessName, clientId } = args;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://sitering.ai").replace(
    /\/$/,
    "",
  );
  const loginUrl = `${appUrl}/login?client_id=${clientId}`;
  const firstName = ownerName.split(" ")[0] || "there";

  const text = [
    `Hi ${firstName},`,
    ``,
    `Your SiteRing AI account for ${businessName} is set up.`,
    ``,
    `Your Client ID (this is your dashboard login — keep it safe):`,
    clientId,
    ``,
    `Open your dashboard: ${loginUrl}`,
    ``,
    `We've received your ID and proof of address and submitted them to Telnyx`,
    `for number verification. That usually completes within one working day —`,
    `we'll email you as soon as your number is live.`,
    ``,
    `— The SiteRing AI team`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#0b0f10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e7ecec;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#111718;border:1px solid #1f2a2b;border-radius:16px;">
      <tr>
        <td style="padding:28px 28px 8px;">
          <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#34d399;">SiteRing AI</p>
          <h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;color:#ffffff;">You're all set up, ${escapeHtml(firstName)}</h1>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#9fb0b0;">
            Your account for <strong style="color:#e7ecec;">${escapeHtml(businessName)}</strong> has been created.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 0;">
          <div style="border:1px solid rgba(52,211,153,.3);background:rgba(52,211,153,.07);border-radius:14px;padding:18px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#34d399;">Your Client ID — this is your dashboard login</p>
            <p style="margin:10px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:16px;font-weight:700;color:#ffffff;word-break:break-all;">${escapeHtml(clientId)}</p>
          </div>
          <p style="margin:20px 0 0;">
            <a href="${loginUrl}" style="display:inline-block;background:#10b981;color:#04150f;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:12px;">Open my dashboard</a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 28px 30px;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#9fb0b0;">
            We've received your ID and proof of address and submitted them to <strong style="color:#e7ecec;">Telnyx</strong> for number verification. That usually completes within one working day — we'll email you the moment your number is live.
          </p>
          <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6f8382;">
            Keep this Client ID somewhere safe — anyone with it can view your call logs. If you lose it, reply to this email and we'll help.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return send({
    to,
    subject: `Your SiteRing AI Client ID for ${businessName}`,
    html,
    text,
    replyTo: process.env.EMAIL_REPLY_TO,
  });
}

/** Optional internal heads-up so staff can start Telnyx verification. */
export async function sendNewClientNotification(args: {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string | null;
  clientId: string;
  documentsUploaded: boolean;
}): Promise<boolean> {
  const notify = process.env.ONBOARDING_NOTIFY_EMAIL;
  if (!notify) return false;

  const lines = [
    `New SiteRing AI onboarding`,
    ``,
    `Business:  ${args.businessName}`,
    `Owner:     ${args.ownerName}`,
    `Email:     ${args.email}`,
    `Phone:     ${args.phone ?? "—"}`,
    `Client ID: ${args.clientId}`,
    `Documents: ${args.documentsUploaded ? "ID + proof of address uploaded" : "MISSING — follow up"}`,
  ];

  return send({
    to: notify,
    subject: `New onboarding: ${args.businessName}`,
    html: `<pre style="font-family:ui-monospace,monospace;font-size:14px;">${escapeHtml(
      lines.join("\n"),
    )}</pre>`,
    text: lines.join("\n"),
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
