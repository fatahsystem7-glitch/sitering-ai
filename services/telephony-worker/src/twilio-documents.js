/**
 * sitering-ai :: Supporting Document upload helper.
 *
 * Attribute-only documents (e.g. individual_address / business_address) go to the
 * normal API host. Documents that carry an actual file -- everything a sole trader
 * needs -- must be POSTed as multipart/form-data to numbers-upload.twilio.com,
 * which the Twilio Node helper does not cover. Hence the hand-rolled fetch.
 */

import { supabase } from './supabase.js';

const UPLOAD_HOST = 'https://numbers-upload.twilio.com/v2/RegulatoryCompliance/SupportingDocuments';

function authHeader() {
  const raw = `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

/** Pull a stored compliance document out of the private Supabase bucket. */
export async function downloadStoredDocument(storagePath) {
  const { data, error } = await supabase.storage.from('compliance-docs').download(storagePath);
  if (error) throw new Error(`Could not read ${storagePath}: ${error.message}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  return { buffer, mimeType: data.type || 'application/octet-stream' };
}

/**
 * Create a Supporting Document WITH a file attached.
 * @returns {Promise<string>} the RD… SID
 */
export async function uploadSupportingDocument({ friendlyName, type, attributes, file, fileName, mimeType }) {
  const form = new FormData();
  form.append('FriendlyName', friendlyName);
  form.append('Type', type);
  form.append('Attributes', JSON.stringify(attributes ?? {}));
  form.append('File', new Blob([file], { type: mimeType }), fileName);

  const res = await fetch(UPLOAD_HOST, {
    method: 'POST',
    headers: { Authorization: authHeader() },
    body: form,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Twilio document upload failed (${res.status} ${type}): ${body.message ?? 'unknown error'}`
    );
  }
  return body.sid;
}

/**
 * Take every stored document for a tenant, push it to Twilio, and record the SIDs.
 * @returns {Promise<string[]>} supporting document SIDs
 */
export async function uploadTenantDocuments(tenant) {
  const { data: docs, error } = await supabase
    .from('compliance_documents')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('upload_status', 'stored');

  if (error) throw new Error(`Could not list documents: ${error.message}`);
  if (!docs?.length) return [];

  const sids = [];
  for (const doc of docs) {
    const { buffer, mimeType } = await downloadStoredDocument(doc.storage_path);

    // Twilio matches the names on the ID against the end user record.
    const attributes =
      doc.requirement === 'proof_of_identity'
        ? { first_name: tenant.contact_first_name, last_name: tenant.contact_last_name }
        : {};

    const sid = await uploadSupportingDocument({
      friendlyName: `${tenant.slug}-${doc.requirement}`,
      type: doc.twilio_type,
      attributes,
      file: buffer,
      fileName: doc.file_name ?? `${doc.requirement}.pdf`,
      mimeType: doc.mime_type ?? mimeType,
    });

    await supabase
      .from('compliance_documents')
      .update({ document_sid: sid, upload_status: 'uploaded' })
      .eq('id', doc.id);

    sids.push(sid);
  }
  return sids;
}
