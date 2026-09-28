#!/usr/bin/env node
/**
 * Render every transactional email to static HTML so you can eyeball the
 * formatting without sending anything or holding a Resend key.
 *
 *   node scripts/preview-emails.mjs
 *   -> writes email-previews/*.html  (gitignored)
 *
 * Open them in a browser, or preview them directly in the workspace viewer.
 * This catches layout problems; it does NOT catch client-specific quirks
 * (Outlook, Gmail clipping) — for those, actually send one with
 * scripts/send-test-email.mjs.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'email-previews');

// The mailer imports supabase.js, which only warns when env is missing.
process.env.APP_BASE_URL ||= 'https://app.sitering.ai';

const { TEMPLATES } = await import(
  join(ROOT, 'services/telephony-worker/src/mailer.js')
);

const tenant = {
  id: '00000000-0000-0000-0000-000000000001',
  business_name: "Dave's Plumbing & Heating",
  contact_first_name: 'Dave',
  contact_email: 'dave@example.co.uk',
};

const SAMPLES = {
  renewal_opened: {
    tenant,
    bundle: {
      bundle_sid: 'BU00000000000000000000000000000001',
      valid_until: new Date(Date.now() + 21 * 864e5).toISOString(),
      phone_number: '+442079460123',
    },
  },
  documents_rejected: {
    tenant,
    bundle: { bundle_sid: 'BU00000000000000000000000000000001' },
    reason:
      'Proof of Identity: First Name — The First Name is missing. Or, it does not match the ' +
      'First Name you entered within Individual information. (The name on your document must ' +
      'match the name on your account exactly — including middle names and any "Ltd".)',
  },
  number_live: { tenant, e164: '+442079460123' },
};

mkdirSync(OUT, { recursive: true });

const index = [];
for (const [kind, args] of Object.entries(SAMPLES)) {
  const built = TEMPLATES[kind](args);
  const file = join(OUT, `${kind}.html`);
  writeFileSync(file, built.html);
  writeFileSync(join(OUT, `${kind}.txt`), `Subject: ${built.subject}\n\n${built.text}`);
  index.push({ kind, subject: built.subject, file: `${kind}.html` });
  console.log(`✓ ${kind}\n  subject: ${built.subject}\n  → email-previews/${kind}.html`);
}

// A single page showing all three, so one click reviews everything.
writeFileSync(
  join(OUT, 'index.html'),
  `<!doctype html><html><head><meta charset="utf-8"><title>sitering email previews</title></head>
<body style="margin:0;background:#eef0f3;font-family:system-ui,sans-serif">
<div style="max-width:620px;margin:0 auto;padding:24px 0">
<h1 style="font-size:20px">Transactional email previews</h1>
<p style="font-size:14px;color:#4b5563">Rendered locally — nothing was sent.</p>
${index
  .map(
    (i) => `<div style="margin:22px 0">
  <p style="font-size:12px;color:#6b7280;margin:0 0 6px">
    <strong>${i.kind}</strong> — Subject: ${i.subject}</p>
  <iframe src="${i.file}" style="width:100%;height:520px;border:1px solid #d4d4d8;border-radius:10px;background:#fff"></iframe>
</div>`
  )
  .join('\n')}
</div></body></html>`
);

console.log(`\nAll previews: email-previews/index.html`);
