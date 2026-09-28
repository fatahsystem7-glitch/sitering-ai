import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = Boolean(url && key);

if (!supabaseConfigured) {
  console.warn(
    '[sitering] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — ' +
      'database calls will fail. Fine for tooling (email previews, tests); ' +
      'the server refuses to start without them.'
  );
}

// createClient throws on an empty URL, which would turn a missing-env mistake
// into an unreadable stack trace at import time — and would stop offline tools
// like scripts/preview-emails.mjs importing this module at all. Use an obviously
// fake placeholder instead and let server.js do the real fail-fast check.
const effectiveUrl = url || 'http://supabase.invalid';
const effectiveKey = key || 'unset';

// Service-role client: bypasses RLS. Never expose this to the browser.
//
// supabase-js always constructs a RealtimeClient, which needs a global
// WebSocket. Node 22+ has one natively; Node 20 does not and the import throws
// at module load. We inject `ws` so the worker boots on either runtime — we
// don't use realtime at all, this just satisfies the constructor.
export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

export async function logEvent(tenantId, kind, payload = {}) {
  try {
    await supabase.from('provisioning_events').insert({ tenant_id: tenantId, kind, payload });
  } catch (err) {
    console.error('[sitering] logEvent failed', kind, err);
  }
}
