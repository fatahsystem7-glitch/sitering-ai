'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase';
import { ui } from '@/lib/ui';

type EntityType = 'sole_trader' | 'limited_company';

const IDENTITY_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'government_issued_document', label: 'Government-issued ID (e.g. driving licence)' },
];

const ADDRESS_TYPES = [
  { value: 'utility_bill', label: 'Utility bill' },
  { value: 'tax_notice', label: 'Council tax / tax notice' },
  { value: 'rent_receipt', label: 'Rent receipt or tenancy agreement' },
  { value: 'title_deed', label: 'Title deed / mortgage statement' },
  { value: 'government_issued_document', label: 'Government-issued ID showing this address' },
];

export default function OnboardingForm({
  tenantId,
  initial,
}: {
  tenantId: string;
  initial: Record<string, any>;
}) {
  const router = useRouter();
  const supabase = browserClient();

  const [entityType, setEntityType] = useState<EntityType>(
    (initial.entity_type as EntityType) ?? 'sole_trader'
  );
  const [form, setForm] = useState({
    legalName: initial.legal_name ?? initial.business_name ?? '',
    registrationNumber: initial.registration_number ?? '',
    contactFirstName: initial.contact_first_name ?? '',
    contactLastName: initial.contact_last_name ?? '',
    contactEmail: initial.contact_email ?? '',
    contactPhone: initial.contact_phone ?? '',
    street: initial.address_street ?? '',
    city: initial.address_city ?? '',
    region: initial.address_region ?? '',
    postcode: initial.address_postcode ?? '',
    areaCode: '',
  });

  const [identityType, setIdentityType] = useState('passport');
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [addressType, setAddressType] = useState('utility_bill');
  const [addressFile, setAddressFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('');

  const isSole = entityType === 'sole_trader';
  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function upload(file: File, requirement: string, twilioType: string) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const path = `${tenantId}/${requirement}-${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('compliance-docs')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { error: rowErr } = await supabase.from('compliance_documents').insert({
      tenant_id: tenantId,
      requirement,
      twilio_type: twilioType,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });
    if (rowErr) throw new Error(`Could not record document: ${rowErr.message}`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (isSole && (!identityFile || !addressFile)) {
      setError('Sole traders must upload both proof of identity and proof of address.');
      return;
    }
    if (!isSole && !form.registrationNumber.trim()) {
      setError('Limited companies must provide a Companies House number (CRN).');
      return;
    }

    setBusy(true);
    try {
      setStep('Saving your details…');
      const { error: tErr } = await supabase
        .from('tenants')
        .update({
          entity_type: entityType,
          legal_name: form.legalName,
          registration_number: isSole ? null : form.registrationNumber,
          contact_first_name: form.contactFirstName,
          contact_last_name: form.contactLastName,
          contact_phone: form.contactPhone,
          address_street: form.street,
          address_city: form.city,
          address_region: form.region || form.city,
          address_postcode: form.postcode,
        })
        .eq('id', tenantId);
      if (tErr) throw new Error(tErr.message);

      if (isSole) {
        setStep('Uploading your documents…');
        await upload(identityFile!, 'proof_of_identity', identityType);
        await upload(addressFile!, 'proof_of_address', addressType);
      }

      setStep('Submitting to Twilio for regulatory approval…');
      const res = await fetch('/api/provision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          areaCode: form.areaCode || undefined,
          business: {
            entityType,
            legalName: form.legalName,
            registrationNumber: form.registrationNumber,
            contactFirstName: form.contactFirstName,
            contactLastName: form.contactLastName,
            contactEmail: form.contactEmail,
            contactPhone: form.contactPhone,
            street: form.street,
            city: form.city,
            region: form.region || form.city,
            postcode: form.postcode,
          },
        }),
      });

      const payload = await res.json();
      if (!res.ok && res.status !== 202) {
        throw new Error(payload.detail || payload.error || 'Provisioning failed');
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setBusy(false);
      setStep('');
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {/* ---------------------------------------------------- entity type */}
      <div style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>How is your business set up?</h2>
        <p style={ui.hint}>
          This decides which documents Ofcom-regulated carriers require before we can issue
          your UK number. Most UK trades are sole traders.
        </p>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr', marginTop: 14 }}>
          {([
            ['sole_trader', 'Sole trader', 'Self-employed, no CRN. Needs photo ID + proof of address.'],
            ['limited_company', 'Limited company', 'Registered at Companies House. Needs your CRN.'],
          ] as const).map(([value, title, desc]) => (
            <button
              type="button"
              key={value}
              onClick={() => setEntityType(value)}
              style={{
                textAlign: 'left',
                padding: 14,
                borderRadius: 10,
                cursor: 'pointer',
                border: entityType === value ? '2px solid #111827' : '1px solid #d4d4d8',
                background: entityType === value ? '#f9fafb' : '#fff',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
              <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 4 }}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------- identity */}
      <div style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>
          {isSole ? 'Your details' : 'Company details'}
        </h2>

        <label style={ui.label}>
          {isSole ? 'Trading name (or your full name)' : 'Registered company name'}
        </label>
        <input required style={ui.input} value={form.legalName} onChange={set('legalName')} />
        <p style={ui.hint}>
          {isSole
            ? 'Must match the name on your ID exactly — mismatches are the top rejection reason.'
            : 'Must match Companies House exactly, including “Ltd” or “Limited”.'}
        </p>

        {!isSole && (
          <div style={{ marginTop: 14 }}>
            <label style={ui.label}>Company registration number (CRN)</label>
            <input
              required
              style={ui.input}
              placeholder="12345678"
              value={form.registrationNumber}
              onChange={set('registrationNumber')}
            />
          </div>
        )}

        <div style={{ ...ui.row, marginTop: 14 }}>
          <div>
            <label style={ui.label}>First name</label>
            <input required style={ui.input} value={form.contactFirstName} onChange={set('contactFirstName')} />
          </div>
          <div>
            <label style={ui.label}>Last name</label>
            <input required style={ui.input} value={form.contactLastName} onChange={set('contactLastName')} />
          </div>
        </div>

        <div style={{ ...ui.row, marginTop: 14 }}>
          <div>
            <label style={ui.label}>Contact email</label>
            <input required type="email" style={ui.input} value={form.contactEmail} onChange={set('contactEmail')} />
          </div>
          <div>
            <label style={ui.label}>Mobile number</label>
            <input required style={ui.input} placeholder="+447700900123"
                   value={form.contactPhone} onChange={set('contactPhone')} />
            <p style={ui.hint}>A real mobile you answer — not a VoIP number.</p>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------- address */}
      <div style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>
          {isSole ? 'Your UK address' : 'UK trading address'}
        </h2>
        <p style={ui.hint}>
          Must be a real UK address. PO boxes, mailbox services and virtual offices are
          rejected by Twilio.
        </p>
        <div style={{ marginTop: 12 }}>
          <label style={ui.label}>Street address</label>
          <input required style={ui.input} value={form.street} onChange={set('street')} />
        </div>
        <div style={{ ...ui.row, marginTop: 14 }}>
          <div>
            <label style={ui.label}>Town / city</label>
            <input required style={ui.input} value={form.city} onChange={set('city')} />
          </div>
          <div>
            <label style={ui.label}>County (optional)</label>
            <input style={ui.input} value={form.region} onChange={set('region')} />
          </div>
        </div>
        <div style={{ ...ui.row, marginTop: 14 }}>
          <div>
            <label style={ui.label}>Postcode</label>
            <input required style={ui.input} placeholder="SW1A 1AA"
                   value={form.postcode} onChange={set('postcode')} />
          </div>
          <div>
            <label style={ui.label}>Preferred area code (optional)</label>
            <input style={ui.input} placeholder="20 for London, 161 for Manchester"
                   value={form.areaCode} onChange={set('areaCode')} />
          </div>
        </div>
      </div>

      {/* ------------------------------------------- sole-trader documents */}
      {isSole && (
        <div style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Identity documents</h2>
          <p style={ui.hint}>
            Required by UK telecoms regulation for self-employed applicants. Stored
            encrypted and sent only to Twilio&apos;s regulatory team. PDF, JPG or PNG, max 10 MB.
          </p>

          <div style={{ marginTop: 16 }}>
            <label style={ui.label}>Proof of identity</label>
            <select style={ui.input} value={identityType} onChange={(e) => setIdentityType(e.target.value)}>
              {IDENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              required
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => setIdentityFile(e.target.files?.[0] ?? null)}
              style={{ ...ui.input, marginTop: 8, padding: 8 }}
            />
            <p style={ui.hint}>The name on this document must match the name entered above.</p>
          </div>

          <div style={{ marginTop: 18 }}>
            <label style={ui.label}>Proof of address</label>
            <select style={ui.input} value={addressType} onChange={(e) => setAddressType(e.target.value)}>
              {ADDRESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              required
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => setAddressFile(e.target.files?.[0] ?? null)}
              style={{ ...ui.input, marginTop: 8, padding: 8 }}
            />
            <p style={ui.hint}>Dated within the last 3 months and showing the address above.</p>
          </div>
        </div>
      )}

      {error && (
        <div style={{ ...ui.card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={busy} style={{ ...ui.button, opacity: busy ? 0.6 : 1 }}>
        {busy ? step || 'Working…' : 'Submit and get my number'}
      </button>
      <p style={ui.hint}>
        Twilio reviews submissions manually — usually a few hours, sometimes 1–2 working days.
        We&apos;ll email you the moment your number is live.
      </p>
    </form>
  );
}
