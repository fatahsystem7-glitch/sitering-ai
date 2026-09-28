import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase';
import { ui, statusTone } from '@/lib/ui';
import AgentConfigEditor from './AgentConfigEditor';

export const dynamic = 'force-dynamic';

const BUNDLE_COPY: Record<string, string> = {
  draft: 'Your submission is incomplete — Twilio flagged missing or invalid details.',
  'pending-review': 'Submitted to Twilio. Regulatory review usually takes a few hours.',
  'in-review': 'Twilio is reviewing your documents right now.',
  'twilio-approved': 'Approved. Your number is live.',
  'provisionally-approved': 'Provisionally approved — your number is live.',
  'twilio-rejected': 'Rejected. Check the reason below and re-submit corrected documents.',
};

export default async function DashboardPage() {
  const supabase = serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/signup');

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (!tenant) redirect('/onboarding');

  const [{ data: configs }, { data: numbers }, { data: bundle }, { data: calls }] =
    await Promise.all([
      supabase.from('agent_configs').select('*').eq('tenant_id', tenant.id).order('created_at'),
      supabase.from('phone_numbers').select('*').eq('tenant_id', tenant.id),
      // Only the primary bundle — revalidation copies are an implementation
      // detail the contractor should never see.
      supabase
        .from('compliance_bundles')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('role', 'primary')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('calls')
        .select('id, from_e164, started_at, duration_secs, summary, outcome')
        .eq('tenant_id', tenant.id)
        .order('started_at', { ascending: false })
        .limit(10),
    ]);

  const live = numbers?.find((n: any) => n.status === 'provisioned');
  const config = configs?.[0];

  // Sole traders are the only ones who ever have to touch documents.
  const needsDocs =
    bundle?.status === 'twilio-rejected' ||
    ['required', 'copy-open', 'failed'].includes(bundle?.revalidation_state ?? 'none');

  return (
    <main style={ui.page}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>{tenant.business_name}</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 13.5 }}>
            {tenant.entity_type === 'sole_trader' ? 'Sole trader' : 'Limited company'}
            {tenant.trade ? ` · ${tenant.trade}` : ''}
          </p>
        </div>
        <span style={statusTone(tenant.status)}>{tenant.status}</span>
      </header>

      {/* ------------------------------------------------------ number card */}
      <div style={{ ...ui.card, marginTop: 22 }}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Your number</h2>
        {live ? (
          <>
            <p style={{ fontSize: 30, fontWeight: 700, margin: '10px 0 4px', letterSpacing: 0.5 }}>
              {live.e164}
            </p>
            <p style={ui.hint}>
              Live and answering. Divert your mobile here, or advertise it directly.
            </p>
          </>
        ) : bundle ? (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '10px 0' }}>
              <span style={statusTone(bundle.status)}>{bundle.status.replace(/-/g, ' ')}</span>
            </div>
            <p style={{ fontSize: 14, color: '#4b5563', margin: 0 }}>
              {BUNDLE_COPY[bundle.status] ?? 'Awaiting Twilio.'}
            </p>
            {bundle.failure_reason && (
              <pre
                style={{
                  marginTop: 12, padding: 12, background: '#fef2f2', color: '#991b1b',
                  borderRadius: 8, fontSize: 12, whiteSpace: 'pre-wrap', overflowX: 'auto',
                }}
              >
                {bundle.failure_reason}
              </pre>
            )}
            {(bundle.status === 'twilio-rejected' || bundle.status === 'draft') && (
              <Link href="/onboarding" style={{ ...ui.ghostButton, display: 'inline-block', marginTop: 12, textDecoration: 'none', color: '#111827' }}>
                Re-submit details
              </Link>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: '#4b5563' }}>
              You haven&apos;t requested a number yet.
            </p>
            <Link href="/onboarding" style={{ ...ui.button, display: 'inline-block', textDecoration: 'none' }}>
              Get my number
            </Link>
          </>
        )}
      </div>

      {/* -------------------------------------------- renewal / documents */}
      {tenant.entity_type === 'sole_trader' && (
        <div
          style={{
            ...ui.card,
            ...(needsDocs
              ? { background: '#fffbeb', borderColor: '#fde68a' }
              : {}),
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 4, fontSize: 16 }}>
                {needsDocs ? 'Action needed on your documents' : 'Verification documents'}
              </h2>
              <p style={{ fontSize: 13.5, color: '#4b5563', margin: 0 }}>
                {needsDocs
                  ? bundle?.status === 'twilio-rejected'
                    ? 'Twilio rejected your documents. Upload replacements — your setup is saved.'
                    : `Your verification needs renewing${
                        bundle?.valid_until
                          ? ` before ${new Date(bundle.valid_until).toLocaleDateString('en-GB')}`
                          : ''
                      }. Your number keeps working while we sort it.`
                  : 'Your ID and proof of address are on file and valid.'}
              </p>
            </div>
            <Link
              href="/dashboard/documents"
              style={{
                ...(needsDocs ? ui.button : ui.ghostButton),
                display: 'inline-block',
                textDecoration: 'none',
                color: needsDocs ? '#fff' : '#111827',
                whiteSpace: 'nowrap',
              }}
            >
              {needsDocs ? 'Fix now' : 'Manage'}
            </Link>
          </div>
        </div>
      )}

      {/* -------------------------------------------------- config editor */}
      {config ? (
        <AgentConfigEditor config={config} />
      ) : (
        <div style={ui.card}>No receptionist configured yet.</div>
      )}

      {/* --------------------------------------------------- recent calls */}
      <div style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Recent calls</h2>
        {calls?.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: 12 }}>
                <th style={th}>When</th>
                <th style={th}>From</th>
                <th style={th}>Length</th>
                <th style={th}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c: any) => (
                <tr key={c.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={td}>
                    {new Date(c.started_at).toLocaleString('en-GB', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td style={td}>{c.from_e164 ?? 'Withheld'}</td>
                  <td style={td}>{c.duration_secs ? `${c.duration_secs}s` : '—'}</td>
                  <td style={td}>{c.summary ?? c.outcome ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            No calls yet. They&apos;ll appear here as soon as your number rings.
          </p>
        )}
      </div>
    </main>
  );
}

const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '9px 8px', verticalAlign: 'top' };
