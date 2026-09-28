import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRenewalOpened,
  buildDocumentsRejected,
  buildNumberLive,
  TEMPLATES,
} from '../src/mailer.js';

const tenant = {
  id: 't-1',
  business_name: "Dave's Plumbing",
  contact_first_name: 'Dave',
  contact_email: 'dave@example.co.uk',
};

test('renewal email leads with reassurance, not alarm', () => {
  const mail = buildRenewalOpened({
    tenant,
    bundle: { bundle_sid: 'BU1', valid_until: '2026-10-19T00:00:00Z', phone_number: '+442079460123' },
  });

  // The single most important line: this must not read like an outage.
  assert.match(mail.html, /Your number keeps working as normal/);
  assert.match(mail.text, /keeps working as normal/);
  assert.match(mail.html, /19 October 2026/); // en-GB date, not 10\/19
  assert.match(mail.html, /\+442079460123/);
  assert.equal(mail.kind, 'renewal_opened');
  assert.equal(mail.to, 'dave@example.co.uk');
});

test('renewal email copes with no deadline and no number', () => {
  const mail = buildRenewalOpened({ tenant, bundle: { bundle_sid: 'BU1' } });
  assert.doesNotMatch(mail.html, /undefined|null|NaN|Invalid Date/);
  assert.match(mail.html, /when you get a moment/);
});

test('rejection email escapes HTML in the Twilio reason', () => {
  const mail = buildDocumentsRejected({
    tenant,
    bundle: { bundle_sid: 'BU1' },
    reason: '<script>alert("xss")</script> & "quoted"',
  });
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, /&lt;script&gt;/);
  assert.match(mail.html, /&amp;/);
});

test('rejection dedupe key changes when the reason changes', () => {
  const a = buildDocumentsRejected({ tenant, bundle: { bundle_sid: 'BU1' }, reason: 'name mismatch' });
  const b = buildDocumentsRejected({ tenant, bundle: { bundle_sid: 'BU1' }, reason: 'blurry scan' });
  const c = buildDocumentsRejected({ tenant, bundle: { bundle_sid: 'BU1' }, reason: 'name mismatch' });

  assert.notEqual(a.dedupeKey, b.dedupeKey, 'a different rejection must send again');
  assert.equal(a.dedupeKey, c.dedupeKey, 'the same rejection must not resend');
});

test('renewal dedupe key is stable per bundle', () => {
  const a = buildRenewalOpened({ tenant, bundle: { bundle_sid: 'BU1' } });
  const b = buildRenewalOpened({ tenant, bundle: { bundle_sid: 'BU1', valid_until: '2027-01-01' } });
  // Same bundle -> one email, even as the sweep re-runs with more detail.
  assert.equal(a.dedupeKey, b.dedupeKey);
});

test('number-live email shows the number prominently in both parts', () => {
  const mail = buildNumberLive({ tenant, e164: '+442079460123' });
  assert.match(mail.html, /\+442079460123/);
  assert.match(mail.text, /\+442079460123/);
  assert.match(mail.subject, /\+442079460123/);
  assert.equal(mail.dedupeKey, 'number_live:+442079460123');
});

test('every template produces subject, html and plain text', () => {
  const samples = {
    renewal_opened: { tenant, bundle: { bundle_sid: 'BU1' } },
    documents_rejected: { tenant, bundle: { bundle_sid: 'BU1' }, reason: 'x' },
    number_live: { tenant, e164: '+442079460123' },
  };

  for (const [kind, args] of Object.entries(samples)) {
    const mail = TEMPLATES[kind](args);
    assert.ok(mail.subject?.length, `${kind} has no subject`);
    assert.ok(mail.html?.includes('<html'), `${kind} has no html`);
    assert.ok(mail.text?.length > 40, `${kind} plain-text part is too thin`);
    assert.ok(mail.dedupeKey, `${kind} has no dedupe key`);
    // Subject lines get truncated around 78 chars on mobile clients.
    assert.ok(mail.subject.length <= 78, `${kind} subject too long: ${mail.subject.length}`);
    // No unrendered template holes.
    assert.doesNotMatch(mail.html, /undefined|\[object Object\]/);
  }
});

test('falls back gracefully when the contact has no first name', () => {
  const anon = { ...tenant, contact_first_name: null };
  const mail = buildNumberLive({ tenant: anon, e164: '+442079460123' });
  assert.match(mail.html, /Dave's Plumbing/);
  assert.doesNotMatch(mail.html, /Hi null/);
});
