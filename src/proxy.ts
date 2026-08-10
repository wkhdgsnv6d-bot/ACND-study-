import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Route protection and session refresh.
 *
 * Next 16 renamed the `middleware` convention to `proxy`, and the exported
 * function with it. The runtime is Node rather than Edge, which suits the
 * Supabase SSR client.
 *
 * Two jobs:
 *
 * 1. **Refresh the auth session** on every request, writing the rotated cookies
 *    onto the response. Server Components cannot set cookies, so if this did
 *    not happen here, sessions would silently expire mid-study-session.
 * 2. **Guard the application routes.** This is the first line of defence, not
 *    the only one — server actions and route handlers call `requireUser()`
 *    themselves, and row-level security backstops both.
 */

/** Routes reachable without a session. Everything else requires one. */
const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/setup", "/check-email"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // With no Supabase project configured there is no session to refresh and no
  // meaningful way to sign in. Send everything to the setup screen, which
  // explains what to add, rather than to a login form that cannot work.
  if (!isSupabaseConfigured()) {
    if (pathname === "/setup") return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/setup";
    url.search = "";
    return NextResponse.rewrite(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // `getUser()` validates the token with Supabase. `getSession()` would trust
  // a cookie the browser controls, which is not a basis for authorisation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Preserve where they were headed so sign-in can return them to it.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /**
     * Everything except static assets and image files. Auth routes are matched
     * deliberately so the session is refreshed on them too.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
