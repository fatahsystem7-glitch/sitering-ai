'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase';
import { ui, statusTone } from '@/lib/ui';

const TYPES: Record<string, { value: string; label: string }[]> = {
  proof_of_identity: [
    { value: 'passport', label: 'Passport' },
    { value: 'government_issued_document', label: 'Government-issued ID (e.g. driving licence)' },
  ],
  proof_of_address: [
    { value: 'utility_bill', label: 'Utility bill' },
    { value: 'tax_notice', label: 'Council tax / tax notice' },
    { value: 'rent_receipt', label: 'Rent receipt or tenancy agreement' },
    { value: 'title_deed', label: 'Title deed / mortgage statement' },
    { value: 'government_issued_document', label: 'Government-issued ID showing this address' },
  ],
};

const LABEL: Record<string, string> = {
  proof_of_identity: 'Proof of identity',
  proof_of_address: 'Proof of address',
};

const STATUS_COPY: Record<string, string> = {
  stored: 'Ready to send — not yet submitted to Twilio.',
  uploaded: 'Submitted to Twilio and awaiting review.',
  rejected: 'Rejected by Twilio. Upload a replacement below.',
  expiring: 'Needs refreshing before your renewal date.',
  archived: 'Superseded by a newer document.',
};

export default function DocumentManager({
  tenantId,
  overview,
}: {
  tenantId: string;
  overview: any;
}) {
  const router = useRouter();
  const supabase = browserClient();

  const [busy, setBusy] = useState<string>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const docs: any[] = overview.documents ?? [];
  const byReq = (r: string) => docs.filter((d) => d.requirement === r);
  const pendingUpload = docs.some((d) => d.upload_status === 'stored');

  const revalidating = ['required', 'copy-open', 'copy-submitted'].includes(
    overview.revalidation_state
  );
  const rejected = overview.bundle_status === 'twilio-rejected';

  async function replaceDocument(requirement: string, twilioType: string, file: File) {
    setError('');
    setBusy(requirement);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const path = `${tenantId}/${requirement}-${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('compliance-docs')
        .upload(path, file, { contentType: file.type });
      if (upErr) throw new Error(upErr.message);

      // Archive whatever was there before, keeping the audit trail.
      const previous = byReq(requirement).filter((d) => d.upload_status !== 'archived');
      if (previous.length) {
        await supabase
          .from('compliance_documents')
          .update({ upload_status: 'archived', archived_at: new Date().toISOString() })
          .in('id', previous.map((d) => d.id));
      }

      const { error: rowErr } = await supabase.from('compliance_documents').insert({
        tenant_id: tenantId,
        requirement,
        twilio_type: twilioType,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        supersedes_id: previous[0]?.id ?? null,
      });
      if (rowErr) throw new Error(rowErr.message);

      setNotice('Document uploaded. Send it to Twilio when you\u2019re ready.');
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setBusy('');
    }
  }

  async function resubmit() {
    setError('');
    setNotice('');
    setBusy('resubmit');
    try {
      const res = await fetch('/api/compliance/resubmit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const payload = await res.json();
      if (res.status === 202) {
        setNotice(payload.detail ?? 'Submitted to Twilio for review.');
      } else {
        throw new Error(payload.detail ?? payload.error ?? 'Could not submit.');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      {/* ------------------------------------------------- state banner */}
      {revalidating && (
        <div style={{ ...ui.card, background: '#fffbeb', borderColor: '#fde68a' }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Renewal needed</h2>
          <p style={{ fontSize: 14, margin: '6px 0 0', color: '#78350f' }}>
            Twilio has updated the rules behind your number and needs fresh documents
            {overview.valid_until
              ? ` before ${new Date(overview.valid_until).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}`
              : ''}
            . <strong>Your number keeps working normally</strong> while this is sorted —
            we renew it in the background so there&apos;s no interruption.
          </p>
          {overview.revalidation_state === 'copy-submitted' && (
            <p style={{ fontSize: 14, marginBottom: 0, color: '#78350f' }}>
              Your new documents are with Twilio now. Nothing more to do.
            </p>
          )}
        </div>
      )}

      {rejected && (
        <div style={{ ...ui.card, background: '#fef2f2', borderColor: '#fecaca' }}>
          <h2 style={{ marginTop: 0, fontSize: 16, color: '#991b1b' }}>Documents rejected</h2>
          <p style={{ fontSize: 14, color: '#991b1b', margin: '6px 0 0' }}>
            {overview.failure_reason ??
              'Twilio could not verify the documents provided. Replace them below and re-submit.'}
          </p>
        </div>
      )}

      {/* ------------------------------------------------- per requirement */}
      {(['proof_of_identity', 'proof_of_address'] as const).map((requirement) => {
        const items = byReq(requirement).filter((d) => d.upload_status !== 'archived');
        const current = items[0];
        return (
          <div key={requirement} style={ui.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>{LABEL[requirement]}</h2>
              {current && <span style={statusTone(current.upload_status)}>{current.upload_status}</span>}
            </div>

            {current ? (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 14, margin: 0 }}>{current.file_name}</p>
                <p style={ui.hint}>
                  {STATUS_COPY[current.upload_status]}{' '}
                  Uploaded {new Date(current.created_at).toLocaleDateString('en-GB')}.
                </p>
                {current.rejection_note && (
                  <p style={{ ...ui.hint, color: '#991b1b' }}>
                    Twilio said: {current.rejection_note}
                  </p>
                )}
              </div>
            ) : (
              <p style={ui.hint}>Nothing on file yet.</p>
            )}

            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {current ? 'Replace this document' : 'Upload a document'}
              </summary>
              <UploadRow
                requirement={requirement}
                busy={busy === requirement}
                onUpload={replaceDocument}
              />
            </details>
          </div>
        );
      })}

      {error && (
        <div style={{ ...ui.card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ ...ui.card, background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={resubmit}
          disabled={busy === 'resubmit' || !pendingUpload}
          style={{ ...ui.button, opacity: busy === 'resubmit' || !pendingUpload ? 0.5 : 1 }}
        >
          {busy === 'resubmit' ? 'Sending to Twilio…' : 'Send to Twilio for review'}
        </button>
        {!pendingUpload && (
          <span style={ui.hint}>Upload a replacement document to enable this.</span>
        )}
      </div>
    </>
  );
}

function UploadRow({
  requirement,
  busy,
  onUpload,
}: {
  requirement: string;
  busy: boolean;
  onUpload: (requirement: string, twilioType: string, file: File) => void;
}) {
  const [type, setType] = useState(TYPES[requirement][0].value);
  const [file, setFile] = useState<File | null>(null);

  return (
    <div style={{ marginTop: 12 }}>
      <label style={ui.label}>Document type</label>
      <select style={ui.input} value={type} onChange={(e) => setType(e.target.value)}>
        {TYPES[requirement].map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        style={{ ...ui.input, marginTop: 8, padding: 8 }}
      />
      <p style={ui.hint}>
        {requirement === 'proof_of_identity'
          ? 'Name must match your account exactly. Whole document in frame, all corners visible.'
          : 'Dated within the last 3 months and showing your registered address.'}
      </p>
      <button
        type="button"
        disabled={!file || busy}
        onClick={() => file && onUpload(requirement, type, file)}
        style={{ ...ui.ghostButton, marginTop: 6, opacity: !file || busy ? 0.5 : 1 }}
      >
        {busy ? 'Uploading…' : 'Upload'}
      </button>
    </div>
  );
}
