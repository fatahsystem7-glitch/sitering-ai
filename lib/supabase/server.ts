import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "./types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Server-side Supabase client (Server Components, Server Actions, Route Handlers).
 * Reads/writes the auth session via Next.js cookies — RLS still applies.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — cookies are read-only there.
            // Middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
