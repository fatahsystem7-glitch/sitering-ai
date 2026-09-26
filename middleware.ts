import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const CLIENT_SESSION_COOKIE = "sitering_client";

/**
 * • /dashboard/* — the single client dashboard. Gated on the signed
 *   Client-ID session cookie (the signature + Supabase lookup are verified
 *   again in the dashboard layout; this is just a cheap early redirect).
 * • /admin/* — internal staff area, still gated on Supabase Auth.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasClientSession = Boolean(
    request.cookies.get(CLIENT_SESSION_COOKIE)?.value,
  );

  if (pathname.startsWith("/dashboard")) {
    if (!hasClientSession) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next({ request });
  }

  if (pathname === "/login" && hasClientSession) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    dashUrl.search = "";
    return NextResponse.redirect(dashUrl);
  }

  // ── /admin/* — refresh the Supabase Auth session ──────────────
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/admin", "/login"],
};
