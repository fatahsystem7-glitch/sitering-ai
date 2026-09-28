#!/usr/bin/env node
/**
 * Send one real transactional email to an inbox you control, to check how it
 * renders in an actual client before go-live.
 *
 *   RESEND_API_KEY=re_xxx \
 *   MAIL_FROM='sitering <hello@yourdomain.com>' \
 *   node scripts/send-test-email.mjs you@yourdomain.com [kind]
 *
 *   kind = renewal_opened | documents_rejected | number_live | all   (default: all)
 *
 * Bypasses sendOnce()/the notifications table deliberately: this is a delivery
 * and rendering check, not a product flow, and it must not consume a dedupe key
 * that a real tenant might need later.
 *
 * Check in the receiving client:
 *   - subject line not truncated on mobile
 *   - the CTA button renders as a button (Outlook strips some CSS)
 *   - no "[Message clipped]" in Gmail
 *   - dark mode doesn't invert the text into invisibility
 *   - the plain-text part is readable on its own
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [, , recipient, kindArg = 'all'] = process.argv;

if (!recipient) {
  console.error('Usage: node scripts/send-test-email.mjs <recipient> [kind]');
  process.exit(1);
}
if (!process.env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY is not set — nothing would be sent.');
  process.exit(1);
}

process.env.APP_BASE_URL ||= 'https://app.sitering.ai';

const { TEMPLATES } = await import(join(ROOT, 'services/telephony-worker/src/mailer.js'));

const tenant = {
  id: '00000000-0000-0000-0000-000000000001',
  business_name: "Dave's Plumbing & Heating",
  contact_first_name: 'Dave',
  contact_email: recipient,
};

const SAMPLES = {
  renewal_opened: {
    tenant,
    bundle: {
      bundle_sid: 'BUtest',
      valid_until: new Date(Date.now() + 21 * 864e5).toISOString(),
      phone_number: '+442079460123',
    },
  },
  documents_rejected: {
    tenant,
    bundle: { bundle_sid: 'BUtest' },
    reason:
      'Proof of Identity: First Name — The First Name is missing. Or, it does not match the ' +
      'First Name you entered within Individual information.',
  },
  number_live: { tenant, e164: '+442079460123' },
};

const kinds = kindArg === 'all' ? Object.keys(SAMPLES) : [kindArg];
for (const kind of kinds) {
  if (!SAMPLES[kind]) {
    console.error(`Unknown kind "${kind}". Options: ${Object.keys(SAMPLES).join(', ')}, all`);
    process.exit(1);
  }
}

for (const kind of kinds) {
  const built = TEMPLATES[kind](SAMPLES[kind]);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'sitering <hello@sitering.ai>',
      to: [recipient],
      subject: `[TEST] ${built.subject}`,
      html: built.html,
      text: built.text,
      reply_to: process.env.MAIL_REPLY_TO || undefined,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`✗ ${kind} failed (${res.status}): ${body.slice(0, 400)}`);
    if (res.status === 403 || /domain/i.test(body)) {
      console.error(
        '  Hint: Resend only sends from a verified domain. Check SPF/DKIM are green\n' +
          '  in the Resend dashboard and that MAIL_FROM uses that exact domain.'
      );
    }
    process.exitCode = 1;
  } else {
    console.log(`✓ ${kind} sent to ${recipient}`);
  }
}
