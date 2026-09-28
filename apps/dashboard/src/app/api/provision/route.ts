import { NextResponse } from 'next/server';
import { serverClient, adminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * POST /api/provision
 * Called from the onboarding form once the contractor has confirmed their email.
 * Verifies the caller owns the tenant, then hands off to the Railway telephony
 * worker which drives the async Twilio UK compliance + purchase workflow.
 */
export async function POST(req: Request) {
  const supabase = serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json();
  const { tenantId, business, areaCode } = body ?? {};
  if (!tenantId || !business?.legalName) {
    return NextResponse.json({ error: 'tenantId and business.legalName required' }, { status: 400 });
  }

  // Ownership check — RLS-backed read through the user's own session.
  const { data: membership } = await supabase
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const res = await fetch(`${process.env.TELEPHONY_WORKER_URL}/provision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': process.env.INTERNAL_API_TOKEN ?? '',
    },
    body: JSON.stringify({ tenantId, business, areaCode }),
  });

  const payload = await res.json().catch(() => ({}));

  if (res.ok || res.status === 202) {
    await adminClient()
      .from('provisioning_events')
      .insert({ tenant_id: tenantId, kind: 'provision.requested', payload: { areaCode } });
  }

  return NextResponse.json(payload, { status: res.status });
}
