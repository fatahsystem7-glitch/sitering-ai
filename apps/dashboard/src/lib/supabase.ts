import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser client — RLS applies, user only sees their own tenant. */
export function browserClient() {
  return createBrowserClient(URL, ANON);
}

/** Server component / route handler client bound to the user's session cookies. */
export function serverClient() {
  const store = cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a Server Component — middleware refreshes instead */
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS entirely.
 * SERVER ONLY — never import this into a client component.
 */
export function adminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
