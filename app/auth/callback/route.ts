import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Handles the Supabase email-confirmation / OAuth code exchange,
 * then redirects to `next` (default /dashboard).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Capture cookies the Supabase client wants to set, then apply them
  // to the final redirect response.
  const cookiesToApply: CookieToSet[] = [];

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookies: CookieToSet[]) {
            cookies.forEach((c) => {
              request.cookies.set(c.name, c.value);
              cookiesToApply.push(c);
            });
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Respect reverse proxies (Vercel) when building the redirect URL.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const base =
        process.env.NODE_ENV === "development"
          ? origin
          : forwardedHost
            ? `https://${forwardedHost}`
            : origin;

      const response = NextResponse.redirect(`${base}${next}`);
      cookiesToApply.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options),
      );
      return response;
    }
  }

  // Auth failed — back to login with an error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
