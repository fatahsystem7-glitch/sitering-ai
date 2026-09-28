/**
 * sitering-ai :: Twilio UK regulatory compliance automation.
 *
 * Two regulations, two very different shapes:
 *
 *   GB local/national -- BUSINESS (limited company)
 *     end user  : business_info (name, CRN, authorised rep, ISV answer)
 *     documents : business_address (attributes only -- no file upload needed)
 *
 *   GB local/national -- INDIVIDUAL (sole trader)
 *     end user  : individual_info (first/last name, email, mobile)
 *     documents : proof_of_identity  -> passport | government_issued_document  [FILE]
 *                 proof_of_address   -> utility_bill | tax_notice | rent_receipt
 *                                       | title_deed | government_issued_document [FILE]
 *
 * Twilio review is asynchronous, so we submit, persist the SIDs in Supabase, and
 * let the status callback webhook finish the job by purchasing the number.
 */

import { supabase, logEvent } from './supabase.js';
import { uploadTenantDocuments } from './twilio-documents.js';
import { client, rc, VOICE_WEBHOOK, STATUS_CALLBACK } from './twilio-client.js';
import { parseEvaluation } from './evaluation-parser.js';
import { sendNumberLive, sendDocumentsRejected } from './mailer.js';
import { openRevalidationCopy, completeRevalidation } from './twilio-revalidation.js';

export { client };

/** Shared: the UK premises the number will be registered to. */
async function createAddress(tenant, business) {
  return client.addresses.create({
    customerName: business.legalName,
    street: business.street,
    city: business.city,
    region: business.region || business.city,
    postalCode: business.postcode,
    isoCountry: 'GB',
    friendlyName: `${tenant.slug}-address`,
    emergencyEnabled: true, // UK local numbers require an emergency address
  });
}

// ---------------------------------------------------------------- BUSINESS
async function buildBusinessItems(tenant, business, address) {
  const endUser = await rc().endUsers.create({
    friendlyName: business.legalName,
    type: 'business',
    attributes: {
      business_name: business.legalName,
      business_registration_number: business.registrationNumber,
      business_registration_identifier: 'UK:CRN',
      first_name: business.contactFirstName,
      last_name: business.contactLastName,
      email: business.contactEmail,
      phone_number: business.contactPhone,
      business_contact_first_name: business.contactFirstName,
      business_contact_last_name: business.contactLastName,
      business_contact_email: business.contactEmail,
      business_contact_phone: business.contactPhone,
      // GB business regulation asks ISVs whether numbers are reassigned to end customers.
      isv_reseller_or_partner: business.isIsv ? 'true' : 'false',
    },
  });

  // GB local/business needs no uploaded proof -- the address document is attributes only.
  const addressDoc = await rc().supportingDocuments.create({
    friendlyName: `${tenant.slug}-business-address`,
    type: 'business_address',
    attributes: { address_sids: [address.sid], business_name: business.legalName },
  });

  return { endUserSid: endUser.sid, documentSids: [addressDoc.sid] };
}

// -------------------------------------------------------------- SOLE TRADER
async function buildIndividualItems(tenant, business, address) {
  const endUser = await rc().endUsers.create({
    friendlyName: `${business.contactFirstName} ${business.contactLastName}`,
    type: 'individual',
    attributes: {
      first_name: business.contactFirstName,
      last_name: business.contactLastName,
      email: business.contactEmail,
      phone_number: business.contactPhone,
      comments: `Sole trader trading as ${business.legalName}${
        tenant.trade ? ` (${tenant.trade})` : ''
      }. AI receptionist for inbound customer calls.`,
    },
  });

  // Address record, attributes only.
  const addressDoc = await rc().supportingDocuments.create({
    friendlyName: `${tenant.slug}-individual-address`,
    type: 'individual_address',
    attributes: { address_sids: [address.sid] },
  });

  // Proof of identity + proof of address -- real files, uploaded from Supabase Storage.
  const uploadedSids = await uploadTenantDocuments(tenant);

  if (!uploadedSids.length) {
    throw new Error(
      'Sole trader bundles require an uploaded proof of identity and proof of address. ' +
        'No documents were found for this tenant.'
    );
  }

  return { endUserSid: endUser.sid, documentSids: [addressDoc.sid, ...uploadedSids] };
}

/**
 * Build and submit a UK regulatory bundle, branching on entity type.
 *
 * @param {object} tenant   row from public.tenants
 * @param {object} business { entityType: 'sole_trader'|'limited_company', legalName,
 *                            street, city, region, postcode, registrationNumber,
 *                            contactFirstName, contactLastName, contactEmail,
 *                            contactPhone, isIsv }
 */
export async function submitUkBundle(tenant, business) {
  const entityType = business.entityType ?? tenant.entity_type ?? 'limited_company';
  const isSoleTrader = entityType === 'sole_trader';
  const endUserType = isSoleTrader ? 'individual' : 'business';

  // Fail fast on the things Twilio will reject anyway.
  if (!isSoleTrader && !business.registrationNumber) {
    throw new Error('A Companies House registration number (CRN) is required for limited companies.');
  }
  if (!business.postcode || !business.street) {
    throw new Error('A full UK address is required (no PO boxes or virtual offices).');
  }

  const address = await createAddress(tenant, business);

  const { endUserSid, documentSids } = isSoleTrader
    ? await buildIndividualItems(tenant, business, address)
    : await buildBusinessItems(tenant, business, address);

  const bundle = await rc().bundles.create({
    friendlyName: `${tenant.slug} GB local ${endUserType} bundle`,
    email: business.contactEmail,
    endUserType,
    isoCountry: 'GB',
    numberType: 'local',
    statusCallback: STATUS_CALLBACK,
  });

  for (const objectSid of [endUserSid, ...documentSids]) {
    await rc().bundles(bundle.sid).itemAssignments.create({ objectSid });
  }

  // Evaluate before submitting -- a failed evaluation tells us exactly which field
  // is wrong, whereas a rejected bundle costs days.
  const evaluation = await rc().bundles(bundle.sid).evaluations.create();
  const parsed = parseEvaluation(evaluation);
  let status = 'draft';
  if (parsed.compliant) {
    const submitted = await rc().bundles(bundle.sid).update({ status: 'pending-review' });
    status = submitted.status;
  }

  await supabase.from('compliance_bundles').upsert(
    {
      tenant_id: tenant.id,
      bundle_sid: bundle.sid,
      end_user_sid: endUserSid,
      address_sid: address.sid,
      supporting_doc_sids: documentSids,
      regulation_sid: bundle.regulationSid ?? null,
      iso_country: 'GB',
      number_type: 'local',
      end_user_type: endUserType,
      status,
      failure_reason: parsed.summary,
    },
    { onConflict: 'bundle_sid' }
  );

  await logEvent(tenant.id, 'bundle.submitted', {
    bundle_sid: bundle.sid,
    end_user_type: endUserType,
    evaluation_status: evaluation.status,
    status,
    problems: parsed.problems.length,
  });

  return {
    bundleSid: bundle.sid,
    addressSid: address.sid,
    endUserType,
    status,
    evaluation: evaluation.status,
    problems: parsed.problems,
    detail: parsed.summary,
  };
}

/** Search + buy a UK local number and wire it to the LiveKit SIP trunk. */
export async function purchaseUkNumber(tenant, { bundleSid, addressSid, areaCode }) {
  const available = await client
    .availablePhoneNumbers('GB')
    .local.list({ voiceEnabled: true, limit: 5, ...(areaCode ? { areaCode } : {}) });

  if (!available.length) throw new Error('No UK local numbers available from Twilio');

  const purchased = await client.incomingPhoneNumbers.create({
    phoneNumber: available[0].phoneNumber,
    friendlyName: `${tenant.slug} receptionist`,
    bundleSid,
    addressSid,
    voiceUrl: VOICE_WEBHOOK,
    voiceMethod: 'POST',
  });

  await supabase.from('phone_numbers').upsert(
    {
      tenant_id: tenant.id,
      e164: purchased.phoneNumber,
      twilio_sid: purchased.sid,
      iso_country: 'GB',
      number_type: 'local',
      status: 'provisioned',
      provisioned_at: new Date().toISOString(),
    },
    { onConflict: 'e164' }
  );

  await logEvent(tenant.id, 'number.purchased', {
    e164: purchased.phoneNumber,
    sid: purchased.sid,
  });

  try {
    await sendNumberLive({ tenant, e164: purchased.phoneNumber });
  } catch (err) {
    console.error('[sitering] number-live email failed', err?.message ?? err);
  }

  return purchased;
}

/**
 * Handle the async Twilio compliance status callback.
 * On twilio-approved we immediately buy the tenant's number.
 */
export async function handleComplianceCallback(body) {
  const bundleSid = body.bundle_sid || body.BundleSid;
  const status = body.status || body.Status;
  const validUntil = body.valid_until ?? body.ValidUntil ?? null;
  if (!bundleSid) return { ok: false, reason: 'missing bundle_sid' };

  const { data: row } = await supabase
    .from('compliance_bundles')
    .select('*, tenants(*)')
    .eq('bundle_sid', bundleSid)
    .single();

  if (!row) return { ok: false, reason: 'unknown bundle' };

  await supabase
    .from('compliance_bundles')
    .update({
      status,
      failure_reason: body.failure_reason ?? null,
      valid_until: validUntil,
      last_callback_at: new Date().toISOString(),
    })
    .eq('bundle_sid', bundleSid);

  await logEvent(row.tenant_id, 'bundle.status', {
    bundle_sid: bundleSid,
    status,
    role: row.role,
    valid_until: validUntil,
  });

  // ---- This callback is about a revalidation COPY, not a live bundle --------
  // An approved copy is the trigger to swap its items into the original.
  if (row.role === 'copy') {
    if (status === 'twilio-approved' || status === 'provisionally-approved') {
      try {
        const result = await completeRevalidation(row);
        return { ok: true, status, revalidation: result };
      } catch (err) {
        await supabase
          .from('compliance_bundles')
          .update({ revalidation_state: 'failed', revalidation_error: String(err?.message ?? err) })
          .in('bundle_sid', [row.bundle_sid, row.copy_of_bundle_sid]);
        await logEvent(row.tenant_id, 'revalidation.replace_failed', {
          copy: row.bundle_sid,
          error: String(err?.message ?? err),
        });
        return { ok: false, status, error: 'replace_items_failed' };
      }
    }

    if (status === 'twilio-rejected') {
      // The refreshed documents were no good either. Put the ball back in the
      // contractor's court; the original bundle is still valid until its date.
      await supabase
        .from('compliance_documents')
        .update({ upload_status: 'rejected', rejection_note: body.failure_reason ?? null })
        .eq('tenant_id', row.tenant_id)
        .eq('upload_status', 'uploaded')
        .eq('submitted_bundle_sid', row.bundle_sid);

      await supabase
        .from('compliance_bundles')
        .update({ revalidation_state: 'required' })
        .eq('bundle_sid', row.copy_of_bundle_sid);

      await logEvent(row.tenant_id, 'revalidation.copy_rejected', { copy: row.bundle_sid });

      try {
        await sendDocumentsRejected({
          tenant: row.tenants,
          bundle: { bundle_sid: row.bundle_sid },
          reason: body.failure_reason,
        });
      } catch (err) {
        console.error('[sitering] rejection email failed', err?.message ?? err);
      }
    }

    return { ok: true, status, role: 'copy' };
  }

  // ---- Re-verification required on a live bundle ---------------------------
  // Twilio stamps valid_until when the regulation changes. Open the copy now
  // rather than waiting for the deadline; the number stays live meanwhile.
  if (validUntil && ['twilio-approved', 'provisionally-approved'].includes(status)) {
    try {
      const copy = await openRevalidationCopy({ ...row, valid_until: validUntil });
      return { ok: true, status, revalidation: { copy: copy?.bundle_sid, valid_until: validUntil } };
    } catch (err) {
      await supabase
        .from('compliance_bundles')
        .update({ revalidation_state: 'failed', revalidation_error: String(err?.message ?? err) })
        .eq('bundle_sid', bundleSid);
      await logEvent(row.tenant_id, 'revalidation.failed', {
        bundle: bundleSid,
        error: String(err?.message ?? err),
      });
      return { ok: false, status, error: 'revalidation_open_failed' };
    }
  }

  if (status === 'twilio-approved' || status === 'provisionally-approved') {
    const existing = await supabase
      .from('phone_numbers')
      .select('id')
      .eq('tenant_id', row.tenant_id)
      .eq('status', 'provisioned')
      .maybeSingle();

    if (!existing.data) {
      await purchaseUkNumber(row.tenants, { bundleSid, addressSid: row.address_sid });
      await supabase.from('tenants').update({ status: 'active' }).eq('id', row.tenant_id);
    }
  }

  if (status === 'twilio-rejected') {
    // Sole traders almost always fail on document quality -- reset the docs so the
    // contractor can re-upload without us re-sending the same rejected files.
    await supabase
      .from('compliance_documents')
      .update({ upload_status: 'rejected', rejection_note: body.failure_reason ?? null })
      .eq('tenant_id', row.tenant_id)
      .eq('upload_status', 'uploaded');

    await logEvent(row.tenant_id, 'bundle.rejected', { bundle_sid: bundleSid, body });

    try {
      await sendDocumentsRejected({
        tenant: row.tenants,
        bundle: { bundle_sid: bundleSid },
        reason: body.failure_reason ?? row.failure_reason,
      });
    } catch (err) {
      console.error('[sitering] rejection email failed', err?.message ?? err);
    }
  }

  return { ok: true, status };
}
