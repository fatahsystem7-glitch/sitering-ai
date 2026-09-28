import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';

export const runtime = 'nodejs';

/** GET /api/agent-config — the signed-in user's receptionist configs (RLS scoped). */
export async function GET() {
  const supabase = serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('agent_configs')
    .select('*, tenants(business_name, status), phone_numbers:phone_numbers(e164,status)')
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configs: data });
}

/** PATCH /api/agent-config — update prompt/voice/greeting. Live on the next call. */
export async function PATCH(req: Request) {
  const supabase = serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id, ...patch } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const allowed = [
    'display_name',
    'system_prompt',
    'greeting',
    'voice_id',
    'tts_model',
    'llm_model',
    'language',
    'temperature',
    'business_hours',
    'escalation_number',
    'is_active',
  ];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));

  // RLS guarantees the user can only touch their own tenant's row.
  const { data, error } = await supabase
    .from('agent_configs')
    .update(clean)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ config: data });
}
