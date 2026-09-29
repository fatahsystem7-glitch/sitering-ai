import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transactional email over Brevo SMTP.
 *
 * Email remains best-effort so a temporary SMTP outage cannot roll back a
 * completed onboarding. The boolean result is returned to the onboarding API,
 * which only tells the customer an email was sent when Brevo accepted it.
 */

const REQUIRED_SMTP_ENV = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
] as const;

let transporter: Transporter | undefined;
let transporterKey: string | undefined;

function fromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() || "SiteRing AI <onboarding@sitering.ai>"
  );
}

export function emailConfigured(): boolean {
  return REQUIRED_SMTP_ENV.every((key) => Boolean(process.env[key]?.trim()));
}

function getTransporter(): Transporter | null {
  if (!emailConfigured()) return null;

  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT!.trim());
  const user = process.env.SMTP_USER!.trim();
  const pass = process.env.SMTP_PASS!.trim();

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    console.error("[email] SMTP_PORT must be an integer between 1 and 65535.");
    return null;
  }

  // Recreate the transport if environment values change during local hot reload.
  const key = `${host}:${port}:${user}:${pass}`;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host,
      port,
      // Brevo uses STARTTLS on 587 and implicit TLS on 465.
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    transporterKey = key;
  }

  return transporter;
}

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

async function send({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendArgs): Promise<boolean> {
  const smtp = getTransporter();
  if (!smtp) {
    const missing = REQUIRED_SMTP_ENV.filter(
      (key) => !process.env[key]?.trim(),
    );
    console.warn(
      `[email] SMTP is not configured${missing.length ? ` (missing ${missing.join(", ")})` : ""} — skipping send:`,
      subject,
    );
    return false;
  }

  try {
    const info = await smtp.sendMail({
      from: fromAddress(),
      to,
      subject,
      html,
      text,
      ...(replyTo ? { replyTo } : {}),
    });

    if (info.accepted.length === 0) {
      console.error(
        "[email] Brevo did not accept any recipients:",
        info.rejected,
      );
      return false;
    }
    if (info.rejected.length > 0) {
      console.warn("[email] Brevo rejected some recipients:", info.rejected);
    }
    return true;
  } catch (err) {
    console.error("[email] Brevo SMTP send failed:", err);
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
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://sitering.ai"
  ).replace(/\/$/, "");
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
    `We've received your ID and proof of address and submitted them to Twilio`,
    `for UK number verification. That usually takes one to three working days —`,
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
            We've received your ID and proof of address and submitted them to <strong style="color:#e7ecec;">Twilio</strong> for UK number verification. That usually completes within one working day — we'll email you the moment your number is live.
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

/**
 * Sent the moment the number is bought and routed. This is the email the
 * contractor has actually been waiting for, so it leads with the number.
 */
export async function sendNumberLiveEmail(args: {
  to: string;
  ownerName: string;
  businessName: string;
  phoneNumber: string;
  clientId: string;
}): Promise<boolean> {
  const { to, ownerName, businessName, phoneNumber, clientId } = args;
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://sitering.ai"
  ).replace(/\/$/, "");
  const loginUrl = `${appUrl}/login?client_id=${clientId}`;
  const firstName = ownerName.split(" ")[0] || "there";

  const text = [
    `Hi ${firstName},`,
    ``,
    `Good news — your SiteRing AI number for ${businessName} is live:`,
    phoneNumber,
    ``,
    `Your AI receptionist is answering it now. Try ringing it yourself first.`,
    ``,
    `To catch the calls you are missing today, forward your existing mobile to`,
    `this number when you cannot answer. On most UK networks that is:`,
    `  **21*${phoneNumber.replace(/\s/g, "")}#   (forward everything)`,
    `  **61*${phoneNumber.replace(/\s/g, "")}#   (forward when unanswered)`,
    ``,
    `Your dashboard: ${loginUrl}`,
    ``,
    `— SiteRing AI`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#0b1220;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#111a2e;border-radius:12px;">
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;color:#e7ecec;font-size:16px;">Hi ${escapeHtml(firstName)},</p>
        <p style="margin:0 0 20px;color:#9fb0c4;font-size:15px;line-height:1.6;">
          Your SiteRing AI number for <strong style="color:#e7ecec;">${escapeHtml(businessName)}</strong> is live and answering calls.
        </p>
        <p style="margin:0 0 24px;text-align:center;">
          <span style="display:inline-block;padding:16px 28px;background:#0b1220;border:1px solid #23324a;border-radius:10px;color:#4ade80;font-size:24px;font-weight:700;letter-spacing:1px;">${escapeHtml(phoneNumber)}</span>
        </p>
        <p style="margin:0 0 20px;color:#9fb0c4;font-size:15px;line-height:1.6;">
          Ring it yourself first to hear how it sounds. Then forward your existing
          mobile to it when you cannot answer — on most UK networks dial
          <strong style="color:#e7ecec;">**61*${escapeHtml(phoneNumber.replace(/\s/g, ""))}#</strong>
          to forward only the calls you miss.
        </p>
        <p style="margin:0;">
          <a href="${loginUrl}" style="display:inline-block;padding:12px 22px;background:#2563eb;border-radius:8px;color:#fff;text-decoration:none;font-size:15px;">Open your dashboard</a>
        </p>
      </td></tr>
    </table>
  </body>
</html>`;

  return send({
    to,
    subject: `Your SiteRing AI number is live: ${phoneNumber}`,
    html,
    text,
    replyTo: process.env.EMAIL_REPLY_TO,
  });
}

/** Optional internal heads-up so staff can watch the Twilio bundle. */
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
