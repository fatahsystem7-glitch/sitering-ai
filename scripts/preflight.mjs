#!/usr/bin/env node
/**
 * Go-live preflight. Checks every external dependency with real credentials
 * before you place the first call.
 *
 *   node scripts/preflight.mjs
 *
 * Read-only — creates nothing, buys nothing, sends nothing. Exits non-zero if
 * any required check fails.
 */

const results = [];
const record = (ok, name, detail = '', required = true) =>
  results.push({ ok, name, detail, required });

const env = (k) => process.env[k];

// ------------------------------------------------------------------ env vars
const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'FISH_API_KEY',
];
const OPTIONAL = ['DEEPGRAM_API_KEY', 'RESEND_API_KEY', 'PUBLIC_BASE_URL', 'LIVEKIT_SIP_URI'];

for (const k of REQUIRED) record(Boolean(env(k)), `env ${k}`, env(k) ? '' : 'missing');
for (const k of OPTIONAL) record(Boolean(env(k)), `env ${k}`, env(k) ? '' : 'not set', false);

// Catch the classic copy-paste error: anon key pasted into the service-role slot.
if (env('SUPABASE_SERVICE_ROLE_KEY')) {
  try {
    const payload = JSON.parse(
      Buffer.from(env('SUPABASE_SERVICE_ROLE_KEY').split('.')[1], 'base64').toString()
    );
    record(
      payload.role === 'service_role',
      'Supabase key is service_role',
      `token role = ${payload.role}`
    );
  } catch {
    record(true, 'Supabase key is service_role', 'could not decode (new-style key?)', false);
  }
}

// ------------------------------------------------------------------ Supabase
if (env('SUPABASE_URL') && env('SUPABASE_SERVICE_ROLE_KEY')) {
  const headers = {
    apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
    Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
  };
  try {
    const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/tenants?select=id&limit=1`, { headers });
    record(res.ok, 'Supabase REST reachable', res.ok ? '' : `HTTP ${res.status}`);
  } catch (e) {
    record(false, 'Supabase REST reachable', e.message);
  }

  // Migrations applied? Probe the newest objects rather than the oldest.
  for (const [label, path] of [
    ['compliance_documents table', 'compliance_documents?select=id&limit=1'],
    ['notifications table', 'notifications?select=id&limit=1'],
  ]) {
    try {
      const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, { headers });
      record(res.ok, `migration: ${label}`, res.ok ? '' : `HTTP ${res.status} — run supabase db push`);
    } catch (e) {
      record(false, `migration: ${label}`, e.message);
    }
  }

  for (const [label, fn, body] of [
    ['agent_config_for_number', 'agent_config_for_number', { dialled: '+440000000000' }],
    ['compliance_overview', 'compliance_overview', { t: '00000000-0000-0000-0000-000000000000' }],
  ]) {
    try {
      const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      record(res.ok, `rpc: ${label}`, res.ok ? '' : `HTTP ${res.status}`);
    } catch (e) {
      record(false, `rpc: ${label}`, e.message);
    }
  }

  try {
    const res = await fetch(`${env('SUPABASE_URL')}/storage/v1/bucket/compliance-docs`, { headers });
    const bucket = res.ok ? await res.json() : null;
    record(res.ok, 'storage bucket compliance-docs', res.ok ? '' : `HTTP ${res.status}`);
    if (bucket) {
      record(bucket.public === false, 'compliance-docs bucket is PRIVATE', bucket.public ? 'BUCKET IS PUBLIC — passports would be world-readable' : '');
    }
  } catch (e) {
    record(false, 'storage bucket compliance-docs', e.message);
  }
}

// -------------------------------------------------------------------- Twilio
if (env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN')) {
  const auth = `Basic ${Buffer.from(`${env('TWILIO_ACCOUNT_SID')}:${env('TWILIO_AUTH_TOKEN')}`).toString('base64')}`;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env('TWILIO_ACCOUNT_SID')}.json`,
      { headers: { Authorization: auth } }
    );
    const body = res.ok ? await res.json() : {};
    record(res.ok, 'Twilio credentials valid', res.ok ? `${body.friendly_name} (${body.type})` : `HTTP ${res.status}`);
    if (body.type === 'Trial') {
      record(false, 'Twilio account is not a Trial', 'Trial accounts cannot buy UK numbers', false);
    }
  } catch (e) {
    record(false, 'Twilio credentials valid', e.message);
  }

  try {
    const res = await fetch(
      'https://numbers.twilio.com/v2/RegulatoryCompliance/Regulations?IsoCountry=GB&NumberType=local&EndUserType=individual',
      { headers: { Authorization: auth } }
    );
    const body = res.ok ? await res.json() : {};
    const reg = body.results?.[0];
    record(Boolean(reg), 'GB individual (sole trader) regulation readable', reg ? reg.friendly_name : `HTTP ${res.status}`);
    if (reg) {
      // Surfaces the moment Twilio changes what sole traders must provide.
      const docs = (reg.requirements?.supporting_document ?? []).flat().map((d) => d.requirement_name);
      record(true, '  required documents', docs.join(', ') || 'none', false);
    }
  } catch (e) {
    record(false, 'GB individual regulation readable', e.message);
  }

  try {
    const res = await fetch(
      'https://numbers.twilio.com/v2/RegulatoryCompliance/Regulations?IsoCountry=GB&NumberType=local&EndUserType=business',
      { headers: { Authorization: auth } }
    );
    const body = res.ok ? await res.json() : {};
    record(Boolean(body.results?.[0]), 'GB business regulation readable',
      body.results?.[0]?.friendly_name ?? `HTTP ${res.status}`);
  } catch (e) {
    record(false, 'GB business regulation readable', e.message);
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env('TWILIO_ACCOUNT_SID')}/AvailablePhoneNumbers/GB/Local.json?VoiceEnabled=true&PageSize=1`,
      { headers: { Authorization: auth } }
    );
    const body = res.ok ? await res.json() : {};
    const n = body.available_phone_numbers?.length ?? 0;
    record(n > 0, 'UK local numbers in stock', n ? `e.g. ${body.available_phone_numbers[0].phone_number}` : 'none returned');
  } catch (e) {
    record(false, 'UK local numbers in stock', e.message);
  }
}

// -------------------------------------------------------------------- OpenAI
if (env('OPENAI_API_KEY')) {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${env('OPENAI_API_KEY')}` },
    });
    record(res.ok, 'OpenAI key valid', res.ok ? '' : `HTTP ${res.status}`);
  } catch (e) {
    record(false, 'OpenAI key valid', e.message);
  }
}

// ----------------------------------------------------------------- Fish Audio
if (env('FISH_API_KEY')) {
  try {
    const res = await fetch('https://api.fish.audio/model?page_size=1', {
      headers: { Authorization: `Bearer ${env('FISH_API_KEY')}` },
    });
    record(res.ok, 'Fish Audio key valid', res.ok ? '' : `HTTP ${res.status}`);
  } catch (e) {
    record(false, 'Fish Audio key valid', e.message);
  }
}

// --------------------------------------------------------------------- Resend
if (env('RESEND_API_KEY')) {
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}` },
    });
    const body = res.ok ? await res.json() : {};
    const verified = (body.data ?? []).filter((d) => d.status === 'verified').map((d) => d.name);
    record(res.ok, 'Resend key valid', res.ok ? '' : `HTTP ${res.status}`, false);
    record(verified.length > 0, 'Resend has a verified sending domain',
      verified.join(', ') || 'none verified — mail will bounce', false);
  } catch (e) {
    record(false, 'Resend key valid', e.message, false);
  }
}

// -------------------------------------------------------------------- report
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
console.log('\nsitering-ai preflight\n' + '='.repeat(64));
for (const r of results) {
  const mark = r.ok ? '\x1b[32m✓\x1b[0m' : r.required ? '\x1b[31m✗\x1b[0m' : '\x1b[33m!\x1b[0m';
  console.log(`${mark} ${pad(r.name, 44)} ${r.detail}`);
}

const failures = results.filter((r) => !r.ok && r.required);
const warnings = results.filter((r) => !r.ok && !r.required);
console.log('='.repeat(64));
console.log(`${results.filter((r) => r.ok).length} passed, ${failures.length} failed, ${warnings.length} warnings\n`);

if (failures.length) {
  console.error('Not ready for a live call. Fix the ✗ items above.');
  process.exit(1);
}
console.log('Ready. Next: place a test call, then check the calls table for');
console.log('duration_secs, summary and outcome.\n');
