/**
 * sitering-ai :: telephony worker (Railway service).
 * Owns Twilio provisioning, the async compliance webhook, and inbound voice TwiML.
 */

import express from 'express';
import twilio from 'twilio';
import { supabase, logEvent } from './supabase.js';
import { submitUkBundle, purchaseUkNumber, handleComplianceCallback } from './twilio-compliance.js';
import {
  submitRevalidationCopy,
  sweepExpiringBundles,
  REVALIDATION_WINDOW_DAYS,
} from './twilio-revalidation.js';

/** Rebuild the `business` payload from stored tenant columns (for re-submits). */
function businessFromTenant(tenant) {
  return {
    entityType: tenant.entity_type,
    legalName: tenant.legal_name ?? tenant.business_name,
    registrationNumber: tenant.registration_number,
    contactFirstName: tenant.contact_first_name,
    contactLastName: tenant.contact_last_name,
    contactEmail: tenant.contact_email,
    contactPhone: tenant.contact_phone,
    street: tenant.address_street,
    city: tenant.address_city,
    region: tenant.address_region,
    postcode: tenant.address_postcode,
    isIsv: tenant.is_isv,
  };
}

// ---------------------------------------------------------------- env guard
// Fail loudly and immediately rather than 500ing on the first webhook.
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'PUBLIC_BASE_URL',
];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error(
    `[sitering] refusing to start — missing required env: ${missingEnv.join(', ')}`
  );
  process.exit(1);
}
if (!process.env.RESEND_API_KEY) {
  console.warn('[sitering] RESEND_API_KEY not set — transactional email is disabled.');
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const PORT = process.env.PORT || 8080;
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;

/** Shared-secret guard for calls coming from the Next.js dashboard. */
function requireInternalAuth(req, res, next) {
  if (!INTERNAL_TOKEN) return next(); // dev mode
  const header = req.get('x-internal-token');
  if (header !== INTERNAL_TOKEN) return res.status(401).json({ error: 'unauthorised' });
  next();
}

/** Validate that a webhook genuinely came from Twilio. */
function requireTwilioSignature(req, res, next) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.get('x-twilio-signature');
  const url = `${process.env.PUBLIC_BASE_URL}${req.originalUrl}`;
  if (process.env.NODE_ENV !== 'production') return next();
  if (!twilio.validateRequest(token, signature, url, req.body)) {
    return res.status(403).send('invalid signature');
  }
  next();
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'telephony-worker' }));

/**
 * POST /provision  { tenantId, business: {...}, areaCode? }
 * Kicks off the async UK compliance + number workflow at sign-up.
 */
app.post('/provision', requireInternalAuth, async (req, res) => {
  const { tenantId, business, areaCode } = req.body ?? {};
  if (!tenantId || !business?.legalName) {
    return res.status(400).json({ error: 'tenantId and business.legalName are required' });
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();
  if (error || !tenant) return res.status(404).json({ error: 'tenant not found' });

  const entityType = business.entityType ?? tenant.entity_type ?? 'limited_company';

  // Sole traders cannot be submitted without both KYC documents in place -- catch it
  // here rather than burning a rejected bundle and days of review time.
  if (entityType === 'sole_trader') {
    const { data: docs } = await supabase
      .from('compliance_documents')
      .select('requirement')
      .eq('tenant_id', tenantId)
      .eq('upload_status', 'stored');

    const have = new Set((docs ?? []).map((d) => d.requirement));
    const missing = ['proof_of_identity', 'proof_of_address'].filter((r) => !have.has(r));
    if (missing.length) {
      return res.status(400).json({
        error: 'missing_documents',
        missing,
        detail: `Sole trader bundles require ${missing.join(' and ')} before submission.`,
      });
    }
  }

  try {
    const result = await submitUkBundle(tenant, business);

    // Evaluation failed -- tell the contractor exactly what to fix.
    if (result.status === 'draft') {
      return res.status(422).json({
        ...result,
        error: 'evaluation_failed',
        detail: 'Twilio rejected the submission before review. Check the details and re-submit.',
      });
    }

    // Some accounts get instant approval; try to buy straight away if so.
    if (result.status === 'twilio-approved') {
      const number = await purchaseUkNumber(tenant, {
        bundleSid: result.bundleSid,
        addressSid: result.addressSid,
        areaCode,
      });
      return res.json({ ...result, phoneNumber: number.phoneNumber });
    }

    return res.status(202).json({
      ...result,
      message: 'Bundle submitted to Twilio. Number will be purchased on approval callback.',
    });
  } catch (err) {
    console.error('[sitering] provision failed', err);
    await logEvent(tenantId, 'provision.failed', { message: String(err?.message ?? err) });
    return res.status(500).json({ error: 'provisioning failed', detail: String(err?.message ?? err) });
  }
});

/**
 * POST /resubmit  { tenantId }
 * One button for two situations:
 *   - a revalidation copy is open  -> attach the fresh docs and submit the copy
 *   - the live bundle was rejected -> build and submit a brand new bundle
 * Either way the contractor never re-runs onboarding from scratch.
 */
app.post('/resubmit', requireInternalAuth, async (req, res) => {
  const { tenantId } = req.body ?? {};
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tenantId).single();
  if (!tenant) return res.status(404).json({ error: 'tenant not found' });

  // An open revalidation copy always takes priority — the tenant still has a
  // working number and we must not create a competing bundle.
  const { data: copyRow } = await supabase
    .from('compliance_bundles')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('role', 'copy')
    .in('revalidation_state', ['copy-open', 'failed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  try {
    if (copyRow) {
      const result = await submitRevalidationCopy(copyRow, tenant);
      const pending = result.revalidation_state === 'copy-submitted';
      return res.status(pending ? 202 : 422).json({
        mode: 'revalidation',
        bundleSid: copyRow.bundle_sid,
        state: result.revalidation_state,
        detail: pending
          ? 'Updated documents submitted to Twilio. Your number stays live during review.'
          : result.detail ?? 'Twilio could not validate the new documents.',
      });
    }

    // No copy in flight — this is a rejected first-time submission.
    const { data: primary } = await supabase
      .from('compliance_bundles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('role', 'primary')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (primary && !['twilio-rejected', 'draft'].includes(primary.status)) {
      return res.status(409).json({
        error: 'not_resubmittable',
        detail: `Current bundle is ${primary.status}; nothing to re-submit.`,
      });
    }

    const result = await submitUkBundle(tenant, businessFromTenant(tenant));
    return res.status(result.status === 'draft' ? 422 : 202).json({ mode: 'new_bundle', ...result });
  } catch (err) {
    console.error('[sitering] resubmit failed', err);
    await logEvent(tenantId, 'resubmit.failed', { message: String(err?.message ?? err) });
    return res.status(500).json({ error: 'resubmit failed', detail: String(err?.message ?? err) });
  }
});

/**
 * POST /tasks/revalidate
 * Backstop sweep for bundles approaching `valid_until`. Also runs on an internal
 * timer; exposed so Railway Cron (or a manual curl) can trigger it.
 */
app.post('/tasks/revalidate', requireInternalAuth, async (req, res) => {
  try {
    const windowDays = Number(req.body?.windowDays ?? REVALIDATION_WINDOW_DAYS);
    const result = await sweepExpiringBundles(windowDays);
    res.json(result);
  } catch (err) {
    console.error('[sitering] revalidation sweep failed', err);
    res.status(500).json({ error: 'sweep failed', detail: String(err?.message ?? err) });
  }
});

/** Twilio async regulatory bundle status callback. */
app.post('/webhooks/twilio/compliance', requireTwilioSignature, async (req, res) => {
  try {
    const result = await handleComplianceCallback(req.body ?? {});
    res.json(result);
  } catch (err) {
    console.error('[sitering] compliance callback failed', err);
    res.status(500).json({ error: 'callback failed' });
  }
});

/**
 * Inbound voice webhook -> hand the call to the LiveKit SIP trunk.
 * The dialled number travels with the SIP INVITE, which is what the Python
 * agent reads to look up this tenant's prompt in Supabase.
 */
app.post('/webhooks/twilio/voice', requireTwilioSignature, (req, res) => {
  const { VoiceResponse } = twilio.twiml;
  const twiml = new VoiceResponse();
  const sipUri = process.env.LIVEKIT_SIP_URI; // e.g. sip:<trunk>.sip.livekit.cloud

  if (!sipUri) {
    twiml.say({ language: 'en-GB' }, 'Sorry, this line is not yet configured. Please try again later.');
  } else {
    const dial = twiml.dial({ answerOnBridge: true });
    dial.sip(`${sipUri}?x-dialed=${encodeURIComponent(req.body.To ?? '')}`);
  }

  res.type('text/xml').send(twiml.toString());
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[sitering] telephony worker listening on :${PORT}`);
});

/**
 * Daily revalidation sweep. Status callbacks are the primary mechanism; this is
 * the safety net for the ones that get missed (deploy mid-flight, 500, changed
 * webhook URL). A bundle silently expiring means a customer's phone stops
 * ringing, so it's worth the belt and braces.
 *
 * Set REVALIDATION_SWEEP_ENABLED=false on replicas so only one instance sweeps.
 */
if (process.env.REVALIDATION_SWEEP_ENABLED !== 'false') {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const runSweep = async () => {
    try {
      const result = await sweepExpiringBundles();
      if (result.checked) console.log('[sitering] revalidation sweep', JSON.stringify(result));
    } catch (err) {
      console.error('[sitering] revalidation sweep error', err?.message ?? err);
    }
  };
  // Stagger the first run so a rolling deploy doesn't fire several at once.
  setTimeout(runSweep, 60_000 + Math.floor(Math.random() * 60_000));
  setInterval(runSweep, DAY_MS).unref();
}
