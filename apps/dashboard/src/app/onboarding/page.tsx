import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase';
import { ui } from '@/lib/ui';
import OnboardingForm from './OnboardingForm';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/signup');

  // RLS scopes this to the tenants this user belongs to.
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (!tenant) {
    return (
      <main style={ui.page}>
        <h1>Setting up your account…</h1>
        <p style={{ color: '#6b7280' }}>
          We couldn&apos;t find your business record. Refresh in a moment, or contact support
          if this persists.
        </p>
      </main>
    );
  }

  // Already has a live number? Skip straight to the dashboard.
  const { data: number } = await supabase
    .from('phone_numbers')
    .select('e164')
    .eq('tenant_id', tenant.id)
    .eq('status', 'provisioned')
    .maybeSingle();
  if (number) redirect('/dashboard');

  return (
    <main style={ui.page}>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Step 2 of 2</p>
      <h1 style={{ fontSize: 26, marginTop: 0 }}>Let&apos;s get your UK number</h1>
      <p style={{ color: '#4b5563', marginTop: 0, marginBottom: 26 }}>
        UK regulation requires us to verify who&apos;s behind every phone number before it
        goes live. Takes about three minutes.
      </p>
      <OnboardingForm
        tenantId={tenant.id}
        initial={{ ...tenant, contact_email: tenant.contact_email ?? user.email }}
      />
    </main>
  );
}
