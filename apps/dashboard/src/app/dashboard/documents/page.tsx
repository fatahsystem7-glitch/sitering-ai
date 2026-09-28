import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase';
import { ui } from '@/lib/ui';
import DocumentManager from './DocumentManager';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const supabase = serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/signup');

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, business_name, entity_type')
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (!tenant) redirect('/onboarding');

  // Single RPC gives us bundle state, revalidation state and every live document.
  const { data: overview } = await supabase.rpc('compliance_overview', { t: tenant.id });

  return (
    <main style={ui.page}>
      <Link href="/dashboard" style={{ fontSize: 13.5, color: '#4b5563', textDecoration: 'none' }}>
        ← Back to dashboard
      </Link>
      <h1 style={{ fontSize: 24, margin: '10px 0 4px' }}>Verification documents</h1>
      <p style={{ color: '#4b5563', marginTop: 0, marginBottom: 24, fontSize: 14.5 }}>
        UK telecoms rules require us to keep proof of who owns your number on file.
        Replace a document here any time — you never need to start setup again.
      </p>

      {tenant.entity_type === 'limited_company' ? (
        <div style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>No documents needed</h2>
          <p style={{ fontSize: 14, color: '#4b5563', margin: 0 }}>
            As a limited company, your number is verified against your Companies House
            registration — there&apos;s nothing to upload. If Twilio ever needs your details
            refreshed, we handle it automatically without interrupting your service.
          </p>
        </div>
      ) : (
        <DocumentManager tenantId={tenant.id} overview={overview ?? { documents: [] }} />
      )}
    </main>
  );
}
