/**
 * sitering-ai :: bundle re-verification (the `valid_until` dance).
 *
 * Twilio stamps `valid_until` on an approved bundle when the regulation behind it
 * changes. On that date the bundle flips to twilio-rejected and the tenant's phone
 * number stops working. We must refresh the compliance info before then.
 *
 * You cannot edit an approved bundle in place. The supported path is:
 *
 *   1. POST /Bundles/{original}/Copies            -> mutable draft copy
 *   2. replace/refresh the copy's item assignments (new docs, updated end user)
 *   3. POST /Bundles/{copy}/Evaluations           -> find broken fields cheaply
 *   4. PATCH /Bundles/{copy} status=pending-review
 *   5. Twilio approves the COPY (async callback)
 *   6. POST /Bundles/{original}/ReplaceItems {FromBundleSid: copy}
 *   7. DELETE /Bundles/{copy}
 *
 * The original stays `twilio-approved` throughout, so no phone number is ever
 * reassigned and the contractor never loses service.
 */

import { supabase, logEvent } from './supabase.js';
import { uploadTenantDocuments } from './twilio-documents.js';
import { rc, STATUS_CALLBACK } from './twilio-client.js';
import { parseEvaluation } from './evaluation-parser.js';
import { sendRenewalOpened } from './mailer.js';

/** Days before `valid_until` at which we start chasing the tenant. */
export const REVALIDATION_WINDOW_DAYS = Number(process.env.REVALIDATION_WINDOW_DAYS ?? 30);

/**
 * Step 1-2: open a mutable copy of an approved bundle.
 *
 * For limited companies every item is attribute-only, so the copy is already
 * complete and we can submit immediately. For sole traders the identity/address
 * proofs are files that expire, so we need fresh uploads from the contractor
 * before the copy is submittable.
 */
export async function openRevalidationCopy(bundleRow) {
  const tenantId = bundleRow.tenant_id;

  // Don't open a second copy if one is already in flight.
  const { data: existing } = await supabase
    .from('compliance_bundles')
    .select('*')
    .eq('copy_of_bundle_sid', bundleRow.bundle_sid)
    .in('revalidation_state', ['copy-open', 'copy-submitted'])
    .maybeSingle();
  if (existing) return existing;

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  const copy = await rc()
    .bundles(bundleRow.bundle_sid)
    .bundleCopies.create({ friendlyName: `${tenant.slug} revalidation ${new Date().getFullYear()}` });

  const { data: copyRow } = await supabase
    .from('compliance_bundles')
    .insert({
      tenant_id: tenantId,
      bundle_sid: copy.sid,
      copy_of_bundle_sid: bundleRow.bundle_sid,
      role: 'copy',
      iso_country: bundleRow.iso_country,
      number_type: bundleRow.number_type,
      end_user_type: bundleRow.end_user_type,
      address_sid: bundleRow.address_sid,
      end_user_sid: bundleRow.end_user_sid,
      status: 'draft',
      revalidation_state: 'copy-open',
      revalidation_started_at: new Date().toISOString(),
    })
    .select()
    .single();

  await supabase
    .from('compliance_bundles')
    .update({ revalidation_state: 'required', revalidation_started_at: new Date().toISOString() })
    .eq('bundle_sid', bundleRow.bundle_sid);

  await logEvent(tenantId, 'revalidation.copy_opened', {
    original: bundleRow.bundle_sid,
    copy: copy.sid,
    valid_until: bundleRow.valid_until,
  });

  // Limited companies carry no files -- nothing for the contractor to do, so
  // push the copy straight through without bothering them.
  if (bundleRow.end_user_type === 'business') {
    return submitRevalidationCopy(copyRow, tenant);
  }

  // Sole traders must re-upload ID and proof of address, so they need telling.
  // The dashboard shows it too, but nobody logs in unprompted -- and if this
  // deadline passes the number stops ringing.
  try {
    const { data: number } = await supabase
      .from('phone_numbers')
      .select('e164')
      .eq('tenant_id', tenantId)
      .eq('status', 'provisioned')
      .maybeSingle();

    await sendRenewalOpened({
      tenant,
      bundle: {
        bundle_sid: bundleRow.bundle_sid,
        valid_until: bundleRow.valid_until,
        phone_number: number?.e164,
      },
    });
  } catch (err) {
    // Never let a mail failure abort the renewal -- the copy is already open and
    // the sweep will retry the email tomorrow.
    console.error('[sitering] renewal email failed', err?.message ?? err);
    await logEvent(tenantId, 'notification.failed', {
      kind: 'renewal_opened',
      error: String(err?.message ?? err),
    });
  }

  return copyRow;
}

/**
 * Steps 3-4: attach any newly uploaded documents, evaluate, and submit the copy.
 * Safe to call repeatedly — it's what the "Re-submit" button hits.
 */
export async function submitRevalidationCopy(copyRow, tenantArg) {
  const tenant =
    tenantArg ??
    (await supabase.from('tenants').select('*').eq('id', copyRow.tenant_id).single()).data;

  // Any documents the contractor re-uploaded are in 'stored'; push them to Twilio
  // and assign them to the COPY (not the original).
  const freshSids = await uploadTenantDocuments(tenant);
  for (const objectSid of freshSids) {
    try {
      await rc().bundles(copyRow.bundle_sid).itemAssignments.create({ objectSid });
    } catch (err) {
      // Already assigned is fine; anything else is real.
      if (!/already/i.test(err?.message ?? '')) throw err;
    }
  }
  if (freshSids.length) {
    await supabase
      .from('compliance_documents')
      .update({ submitted_bundle_sid: copyRow.bundle_sid })
      .in('document_sid', freshSids);
  }

  const evaluation = await rc().bundles(copyRow.bundle_sid).evaluations.create();
  const parsed = parseEvaluation(evaluation);

  if (!parsed.compliant) {
    const detail = parsed.summary;
    await supabase
      .from('compliance_bundles')
      .update({ revalidation_state: 'copy-open', revalidation_error: detail })
      .eq('bundle_sid', copyRow.bundle_sid);

    await logEvent(copyRow.tenant_id, 'revalidation.evaluation_failed', {
      copy: copyRow.bundle_sid,
    });
    return { ...copyRow, revalidation_state: 'copy-open', evaluation: evaluation.status, detail };
  }

  // Make sure Twilio calls us back about the copy, then submit it.
  await rc().bundles(copyRow.bundle_sid).update({
    status: 'pending-review',
    statusCallback: STATUS_CALLBACK,
  });

  const { data: updated } = await supabase
    .from('compliance_bundles')
    .update({
      status: 'pending-review',
      revalidation_state: 'copy-submitted',
      revalidation_error: null,
    })
    .eq('bundle_sid', copyRow.bundle_sid)
    .select()
    .single();

  await supabase
    .from('compliance_bundles')
    .update({ revalidation_state: 'copy-submitted' })
    .eq('bundle_sid', copyRow.copy_of_bundle_sid);

  await logEvent(copyRow.tenant_id, 'revalidation.copy_submitted', {
    copy: copyRow.bundle_sid,
    original: copyRow.copy_of_bundle_sid,
  });

  return updated;
}

/**
 * Steps 6-7: the copy came back approved. Swap its items into the original and
 * bin the copy. After ReplaceItems, Twilio clears `valid_until` on the original.
 */
export async function completeRevalidation(copyRow) {
  const originalSid = copyRow.copy_of_bundle_sid;

  await rc().bundles(originalSid).replaceItems.create({ fromBundleSid: copyRow.bundle_sid });

  // Re-read the original so we persist Twilio's own view, not our assumption.
  const original = await rc().bundles(originalSid).fetch();

  await supabase
    .from('compliance_bundles')
    .update({
      status: original.status,
      valid_until: original.validUntil ?? null,
      revalidation_state: 'replaced',
      revalidation_error: null,
      last_callback_at: new Date().toISOString(),
    })
    .eq('bundle_sid', originalSid);

  // Archive the documents that have now been superseded on the original.
  await supabase
    .from('compliance_documents')
    .update({ upload_status: 'archived', archived_at: new Date().toISOString() })
    .eq('tenant_id', copyRow.tenant_id)
    .eq('upload_status', 'uploaded')
    .neq('submitted_bundle_sid', copyRow.bundle_sid);

  // Twilio's guidance: delete the copy so the reference stays clean.
  try {
    await rc().bundles(copyRow.bundle_sid).remove();
  } catch (err) {
    console.warn('[sitering] could not delete bundle copy', copyRow.bundle_sid, err?.message);
  }

  await supabase
    .from('compliance_bundles')
    .update({ revalidation_state: 'replaced', status: 'twilio-approved' })
    .eq('bundle_sid', copyRow.bundle_sid);

  await logEvent(copyRow.tenant_id, 'revalidation.completed', {
    original: originalSid,
    copy: copyRow.bundle_sid,
    valid_until: original.validUntil ?? null,
  });

  return { ok: true, original: originalSid, status: original.status };
}

/**
 * Backstop sweep. Status callbacks can be missed — a deploy mid-flight, a 500,
 * a webhook URL change. Run this on a timer so no bundle silently expires.
 */
export async function sweepExpiringBundles(windowDays = REVALIDATION_WINDOW_DAYS) {
  const { data: due, error } = await supabase.rpc('bundles_due_revalidation', {
    window_days: windowDays,
  });
  if (error) throw new Error(`sweep query failed: ${error.message}`);

  const results = [];
  for (const bundleRow of due ?? []) {
    try {
      const copy = await openRevalidationCopy(bundleRow);
      results.push({ bundle: bundleRow.bundle_sid, copy: copy?.bundle_sid, ok: true });
    } catch (err) {
      await supabase
        .from('compliance_bundles')
        .update({ revalidation_state: 'failed', revalidation_error: String(err?.message ?? err) })
        .eq('bundle_sid', bundleRow.bundle_sid);
      await logEvent(bundleRow.tenant_id, 'revalidation.failed', {
        bundle: bundleRow.bundle_sid,
        error: String(err?.message ?? err),
      });
      results.push({ bundle: bundleRow.bundle_sid, ok: false, error: String(err?.message ?? err) });
    }
  }

  // Also nudge along any copy that's been sitting open with fresh docs waiting.
  const { data: openCopies } = await supabase
    .from('compliance_bundles')
    .select('*')
    .eq('role', 'copy')
    .eq('revalidation_state', 'copy-open');

  for (const copyRow of openCopies ?? []) {
    const { count } = await supabase
      .from('compliance_documents')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', copyRow.tenant_id)
      .eq('upload_status', 'stored');

    if (count) {
      try {
        await submitRevalidationCopy(copyRow);
        results.push({ copy: copyRow.bundle_sid, ok: true, action: 'submitted' });
      } catch (err) {
        results.push({ copy: copyRow.bundle_sid, ok: false, error: String(err?.message ?? err) });
      }
    }
  }

  return { checked: (due ?? []).length, results };
}
