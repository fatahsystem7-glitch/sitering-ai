import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const CLIENT_SESSION_COOKIE = "sitering_client";

/**
 * Session middleware for the two supported logins.
 *
 * • Supabase Auth (email + password) — accounts created since migration 08.
 *   The session is refreshed on every matched route.
 * • Client ID (signed cookie) — legacy accounts, unchanged. Their accounts
 *   have no Supabase Auth user, so the cookie is still their credential.
 *
 * • /dashboard/*    — either login gets in.
 * • /admin/*        — staff only: needs a Supabase Auth user (the Client-ID
 *                     cookie deliberately does not count here). The admin
 *                     role itself is enforced by requireAdmin() in the layout.
 * • /login          — already-signed-in users skip to their dashboard.
 * • /reset-password — only reachable with a recovery session.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasClientSession = Boolean(
    request.cookies.get(CLIENT_SESSION_COOKIE)?.value,
  );

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase configured (local/dev) the layouts answer cleanly, so
  // fall back to the cookie check alone rather than failing the request here.
  let hasAuthUser = false;
  if (supabaseUrl && supabaseAnonKey) {
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasAuthUser = Boolean(user);
  }

  const signedIn = hasAuthUser || hasClientSession;

  const isDashboard = pathname.startsWith("/dashboard");
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLogin = pathname === "/login";
  const isReset = pathname === "/reset-password";

  if ((isDashboard || isReset) && !signedIn) {
    return redirectToLogin(request);
  }
  if (isAdmin && !hasAuthUser) {
    return redirectToLogin(request);
  }

  if (isLogin && signedIn) {
    const target = request.nextUrl.clone();
    target.pathname = "/dashboard";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}

/** Send the visitor to /login, remembering where they were headed. */
function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  // The dashboard is the default destination, so no need to echo it back.
  if (request.nextUrl.pathname !== "/dashboard") {
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/admin",
    "/login",
    "/reset-password",
  ],
};

