/**
 * sitering-ai :: transactional email.
 *
 * Supabase Auth handles signup/confirmation mail itself (see docs/SUPABASE_AUTH.md).
 * This module covers the operational emails Supabase knows nothing about:
 * renewals, rejections, and "your number is live".
 *
 * Provider is Resend over HTTPS — no SMTP socket handling, works fine on Railway.
 * If RESEND_API_KEY is unset the mailer logs and no-ops so local dev and tests
 * never try to send anything.
 *
 * Every send is recorded in public.notifications, which also gives us idempotency:
 * the daily revalidation sweep runs forever, but the contractor gets one email.
 */

import { supabase } from './supabase.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM = process.env.MAIL_FROM || 'sitering <hello@sitering.ai>';
const APP_URL = (process.env.APP_BASE_URL || 'https://app.sitering.ai').replace(/\/$/, '');
const REPLY_TO = process.env.MAIL_REPLY_TO || undefined;

const enabled = () => Boolean(process.env.RESEND_API_KEY);

/** Low-level send. Returns true if the provider accepted it. */
async function deliver({ to, subject, html, text }) {
  if (!enabled()) {
    console.log(`[sitering] mail disabled — would send "${subject}" to ${to}`);
    return false;
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text, reply_to: REPLY_TO }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend rejected the message (${res.status}): ${body.slice(0, 300)}`);
  }
  return true;
}

/**
 * Send once per (tenant, kind, dedupe_key). Safe to call from a loop that runs
 * every day — the unique index in Postgres does the deduplication, not us.
 */
export async function sendOnce({ tenantId, kind, dedupeKey, to, subject, html, text }) {
  if (!to) {
    console.warn(`[sitering] no recipient for ${kind} (tenant ${tenantId})`);
    return { sent: false, reason: 'no_recipient' };
  }

  // Claim the slot first. A duplicate key here means we've already sent it.
  const { error: claimError } = await supabase
    .from('notifications')
    .insert({ tenant_id: tenantId, kind, dedupe_key: dedupeKey, recipient: to, subject });

  if (claimError) {
    if (claimError.code === '23505') return { sent: false, reason: 'already_sent' };
    throw new Error(`Could not record notification: ${claimError.message}`);
  }

  try {
    const sent = await deliver({ to, subject, html, text });
    await supabase
      .from('notifications')
      .update({ status: sent ? 'sent' : 'skipped', sent_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('dedupe_key', dedupeKey);
    return { sent, reason: sent ? 'delivered' : 'mailer_disabled' };
  } catch (err) {
    await supabase
      .from('notifications')
      .update({ status: 'failed', error: String(err?.message ?? err) })
      .eq('tenant_id', tenantId)
      .eq('dedupe_key', dedupeKey);
    throw err;
  }
}

// --------------------------------------------------------------- templates

const shell = (heading, body, cta) => `
<!doctype html>
<html><body style="margin:0;background:#f6f7f9;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111827">
  <div style="max-width:520px;margin:32px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
    <p style="font-size:13px;color:#6b7280;margin:0 0 18px">sitering</p>
    <h1 style="font-size:20px;margin:0 0 14px">${heading}</h1>
    ${body}
    ${
      cta
        ? `<p style="margin:24px 0 0">
             <a href="${cta.url}" style="display:inline-block;background:#111827;color:#fff;
                text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600;font-size:14px">
               ${cta.label}</a>
           </p>`
        : ''
    }
    <p style="font-size:12px;color:#9ca3af;margin:26px 0 0">
      Questions? Just reply to this email and a human will read it.
    </p>
  </div>
</body></html>`;

const p = (s) => `<p style="font-size:15px;line-height:1.55;margin:0 0 12px">${s}</p>`;

/**
 * A renewal has opened and we need fresh documents from a sole trader.
 * Deliberately leads with "your number keeps working" — this email must not
 * read like a service outage.
 */
export function buildRenewalOpened({ tenant, bundle }) {
  const deadline = bundle?.valid_until
    ? new Date(bundle.valid_until).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const name = tenant.contact_first_name || tenant.business_name || 'there';
  const number = bundle?.phone_number ? ` (${bundle.phone_number})` : '';

  const body =
    p(`Hi ${name},`) +
    p(
      `The regulator has updated the rules behind UK phone numbers, so Ofcom-regulated
       carriers need an up-to-date copy of your ID and proof of address on file for your
       sitering number${number}.`
    ) +
    p(
      `<strong>Your number keeps working as normal.</strong> Calls will carry on being
       answered while this is sorted — we renew everything in the background.`
    ) +
    p(
      deadline
        ? `Please upload the two documents before <strong>${deadline}</strong>. It takes about two minutes.`
        : `Please upload the two documents when you get a moment. It takes about two minutes.`
    );

  const text = `Hi ${name},

UK telecoms rules require an up-to-date copy of your ID and proof of address for your sitering number${number}.

Your number keeps working as normal while this is sorted.

${deadline ? `Please upload both documents before ${deadline}.` : 'Please upload both documents when you get a moment.'}

Upload here: ${APP_URL}/dashboard/documents`;

  return {
    tenantId: tenant.id,
    kind: 'renewal_opened',
    dedupeKey: `renewal_opened:${bundle?.bundle_sid ?? tenant.id}`,
    to: tenant.contact_email,
    subject: 'Action needed: renew your phone number documents',
    html: shell('Time to refresh your documents', body, {
      url: `${APP_URL}/dashboard/documents`,
      label: 'Upload documents',
    }),
    text,
  };
}

/** Twilio rejected the documents — tell them exactly what to fix. */
export function buildDocumentsRejected({ tenant, bundle, reason }) {
  const name = tenant.contact_first_name || tenant.business_name || 'there';
  const body =
    p(`Hi ${name},`) +
    p(`The verification documents for your sitering number couldn't be accepted.`) +
    (reason
      ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;
           margin:0 0 12px;font-size:14px;color:#991b1b;white-space:pre-wrap">${escapeHtml(reason)}</div>`
      : '') +
    p(
      `Upload replacements and we'll send them straight back — you don't need to redo
       any of your setup.`
    );

  return {
    tenantId: tenant.id,
    kind: 'documents_rejected',
    dedupeKey: `documents_rejected:${bundle?.bundle_sid ?? tenant.id}:${hash(reason ?? '')}`,
    to: tenant.contact_email,
    subject: 'Your verification documents need another look',
    html: shell('We need different documents', body, {
      url: `${APP_URL}/dashboard/documents`,
      label: 'Upload replacements',
    }),
    text: `Hi ${name},

The verification documents for your sitering number couldn't be accepted.

${reason ?? ''}

Upload replacements here (your setup is saved): ${APP_URL}/dashboard/documents`,
  };
}

/** The happy one. */
export function buildNumberLive({ tenant, e164 }) {
  const name = tenant.contact_first_name || tenant.business_name || 'there';
  const body =
    p(`Hi ${name},`) +
    p(`You're verified — your AI receptionist is live on:`) +
    `<p style="font-size:26px;font-weight:700;letter-spacing:.5px;margin:0 0 14px">${e164}</p>` +
    p(
      `Divert your mobile to it, or start advertising it directly. You can change the
       greeting and instructions any time from your dashboard.`
    );

  return {
    tenantId: tenant.id,
    kind: 'number_live',
    dedupeKey: `number_live:${e164}`,
    to: tenant.contact_email,
    subject: `Your new number ${e164} is live`,
    html: shell('Your number is live', body, {
      url: `${APP_URL}/dashboard`,
      label: 'Open dashboard',
    }),
    text: `Hi ${name},

Your AI receptionist is live on ${e164}.

Manage it here: ${APP_URL}/dashboard`,
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/** Tiny stable hash so a changed rejection reason sends a fresh email. */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// ----------------------------------------------------------- send wrappers
// Templates above are pure so they can be previewed and unit-tested without a
// database or an API key. These are the versions the worker actually calls.

export const sendRenewalOpened = (args) => sendOnce(buildRenewalOpened(args));
export const sendDocumentsRejected = (args) => sendOnce(buildDocumentsRejected(args));
export const sendNumberLive = (args) => sendOnce(buildNumberLive(args));

/** Exposed for the preview/test-send scripts. */
export const TEMPLATES = {
  renewal_opened: buildRenewalOpened,
  documents_rejected: buildDocumentsRejected,
  number_live: buildNumberLive,
};

export { deliver as __deliverForTests };
