import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';

/**
 * Supabase email-confirmation landing route.
 * Exchanges the one-time code in the link for a session cookie.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/onboarding';

  if (code) {
    const supabase = serverClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(new URL('/signup?error=confirmation_failed', url.origin));
}
