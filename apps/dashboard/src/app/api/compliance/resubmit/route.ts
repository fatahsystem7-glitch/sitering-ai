import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * POST /api/compliance/resubmit  { tenantId }
 * Re-sends compliance info to Twilio — either finishing an in-flight
 * revalidation copy or replacing a rejected bundle. The worker decides which.
 */
export async function POST(req: Request) {
  const supabase = serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { tenantId } = await req.json();
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const res = await fetch(`${process.env.TELEPHONY_WORKER_URL}/resubmit`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': process.env.INTERNAL_API_TOKEN ?? '',
    },
    body: JSON.stringify({ tenantId }),
  });

  const payload = await res.json().catch(() => ({}));
  return NextResponse.json(payload, { status: res.status });
}
