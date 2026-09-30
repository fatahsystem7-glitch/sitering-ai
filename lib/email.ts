/**
 * Transactional email — Brevo SMTP via Nodemailer.
 *
 * Consolidated from the standalone test deployment into this single project.
 * Configuration (any of these combos works):
 *
 *   BREVO_SMTP_URL=smtp://<login>:<smtp-key>@smtp-relay.brevo.com:587
 *
 *   …or the discrete variables:
 *   SMTP_HOST=smtp-relay.brevo.com     (default)
 *   SMTP_PORT=587                      (default; 465 implies TLS)
 *   SMTP_USER=<brevo smtp login>       (alias: BREVO_SMTP_LOGIN)
 *   SMTP_PASS=<brevo smtp key>         (alias: BREVO_SMTP_KEY)
 *
 * Fully optional: when no SMTP credentials are set we log and no-op so the
 * onboarding flow never fails because of email. The onboarding API reports
 * whether the email actually went out, and the UI adapts its wording.
 */

import nodemailer, { type Transporter } from "nodemailer";

const DEFAULT_HOST = "smtp-relay.brevo.com";
const DEFAULT_PORT = 587;

/** The From header — Brevo requires a validated sender on the account. */
function fromAddress(): string {
  return (
    process.env.EMAIL_FROM ||
    "SiteRing AI <onboarding@sitering.ai>"
  );
}

function replyToAddress(): string | undefined {
  return process.env.EMAIL_REPLY_TO?.trim() || undefined;
}

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

/**
 * Reads the Brevo SMTP configuration from the environment.
 * Returns null when email is not configured (dev / not yet set up).
 */
function smtpConfig(): SmtpConfig | null {
  // 1 · Single-URL form: BREVO_SMTP_URL (or the generic SMTP_URL).
  const url =
    process.env.BREVO_SMTP_URL?.trim() || process.env.SMTP_URL?.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      const user = decodeURIComponent(parsed.username || "");
      const pass = decodeURIComponent(parsed.password || "");
      if (user && pass) {
        return {
          host: parsed.hostname || DEFAULT_HOST,
          port: Number(parsed.port || DEFAULT_PORT),
          secure: (parsed.protocol === "smtps:" || Number(parsed.port) === 465),
          user,
          pass,
        };
      }
    } catch {
      console.error("[email] BREVO_SMTP_URL is not a valid URL — ignoring it.");
    }
  }

  // 2 · Discrete form. Brevo names win over the generic SMTP_ ones.
  const user =
    process.env.BREVO_SMTP_LOGIN?.trim() || process.env.SMTP_USER?.trim() || "";
  const pass =
    process.env.BREVO_SMTP_KEY?.trim() || process.env.SMTP_PASS?.trim() || "";

  if (!user || !pass) return null;

  const port = Number(process.env.SMTP_PORT?.trim() || DEFAULT_PORT);
  return {
    host: process.env.SMTP_HOST?.trim() || DEFAULT_HOST,
    port,
    secure: port === 465,
    user,
    pass,
  };
}

export function emailConfigured(): boolean {
  return smtpConfig() !== null;
}

/** Lazily-created transporter — importable at build time without credentials. */
let cachedTransport: Transporter | null = null;

function transporter(): Transporter | null {
  if (cachedTransport) return cachedTransport;

  const config = smtpConfig();
  if (!config) return null;

  cachedTransport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  return cachedTransport;
}

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

async function send({ to, subject, html, text, replyTo }: SendArgs): Promise<boolean> {
  const mailer = transporter();
  if (!mailer) {
    console.warn("[email] Brevo SMTP not configured — skipping send:", subject);
    return false;
  }

  try {
    const info = await mailer.sendMail({
      from: fromAddress(),
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      text,
      html,
      replyTo: replyTo ?? replyToAddress(),
    });

    if (!info.messageId) {
      console.error("[email] Brevo accepted no message id for:", subject);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Brevo send failed:", err);
    return false;
  }
}

/**
 * Sends the contractor their account details right after signup.
 *
 * The dashboard login is the email + password they chose on the form, so this
 * email leads with that and presents the Client ID as the account reference
 * our support team uses.
 */
export async function sendClientIdEmail(args: {
  to: string;
  ownerName: string;
  businessName: string;
  clientId: string;
  phoneNumber?: string | null;
}): Promise<boolean> {
  const { to, ownerName, businessName, clientId, phoneNumber } = args;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://sitering.ai").replace(
    /\/$/,
    "",
  );
  const loginUrl = `${appUrl}/login`;
  const firstName = ownerName.split(" ")[0] || "there";

  const text = [
    `Hi ${firstName},`,
    ``,
    `Your SiteRing AI account for ${businessName} is set up.`,
    ``,
    `You log in with your email address (${to}) and the password you chose.`,
    ``,
    `Your account reference (Client ID) — quote this if you contact support:`,
    clientId,
    ``,
    phoneNumber
      ? `Your dedicated phone number: ${phoneNumber}`
      : `We've received your ID and proof of address and submitted them to Twilio`,
    phoneNumber
      ? `Your AI receptionist is answering it now.`
      : `for UK number verification. That usually takes one to three working days —`,
    phoneNumber ? `` : `we'll email you as soon as your number is live.`,
    ``,
    `Open your dashboard: ${loginUrl}`,
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
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#34d399;">Your account reference (Client ID)</p>
            <p style="margin:10px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:16px;font-weight:700;color:#ffffff;word-break:break-all;">${escapeHtml(clientId)}</p>
            <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#9fb0b0;">You sign in with <strong style="color:#e7ecec;">${escapeHtml(to)}</strong> and the password you chose at signup.</p>
          </div>
          ${
            phoneNumber
              ? `<div style="margin-top:14px;border:1px solid rgba(52,211,153,.3);background:rgba(52,211,153,.07);border-radius:14px;padding:18px;">
                   <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#34d399;">Your dedicated number — live now</p>
                   <p style="margin:10px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:16px;font-weight:700;color:#ffffff;">${escapeHtml(phoneNumber)}</p>
                 </div>`
              : ``
          }
          <p style="margin:20px 0 0;">
            <a href="${loginUrl}" style="display:inline-block;background:#10b981;color:#04150f;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:12px;">Open my dashboard</a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 28px 30px;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#9fb0b0;">
            ${
              phoneNumber
                ? `Your AI receptionist is answering <strong style="color:#e7ecec;">${escapeHtml(phoneNumber)}</strong> now — ring it yourself first to hear how it sounds.`
                : `We've received your ID and proof of address and submitted them to <strong style="color:#e7ecec;">Twilio</strong> for UK number verification. That usually completes within one working day — we'll email you the moment your number is live.`
            }
          </p>
          <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6f8382;">
            Forgot your password? Use &ldquo;Forgot password?&rdquo; on the login page and we&rsquo;ll email you a reset link. Anything else, just reply to this email.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return send({
    to,
    subject: phoneNumber
      ? `Your SiteRing AI number is live: ${phoneNumber}`
      : `Your SiteRing AI account for ${businessName} is set up`,
    html,
    text,
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
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://sitering.ai").replace(/\/$/, "");
  const loginUrl = `${appUrl}/login`;
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
    `Account reference (Client ID): ${clientId}`,
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
