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

/**
 * Content Security Policy.
 *
 * Script execution is restricted to a per-request nonce plus whatever those
 * scripts load themselves (`strict-dynamic`), which is the part that actually
 * stops injected script from running. Next.js reads the nonce out of this
 * header during server rendering and applies it to its own tags, so nothing
 * needs to thread it through by hand.
 *
 * `style-src` deliberately allows inline styles. Progress bars, skill colours
 * and the study charts all set widths and heights through the `style`
 * attribute, which no nonce can cover — a nonce authorises `<style>` elements,
 * not attributes. Blocking them would break every meter in the app to defend
 * against a class of attack that needs an injection foothold this app does not
 * offer: no user-supplied HTML is ever rendered as markup.
 *
 * `connect-src` must name the Supabase project, because the browser talks to it
 * directly for sign-in and token refresh.
 */
function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const supabase = env.supabaseUrl ?? "";

  return [
    `default-src 'self'`,
    // 'unsafe-eval' is React's dev-only error reconstruction. Never in production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    // https: covers project portfolio screenshots, which are user-supplied URLs.
    `img-src 'self' blob: data: https:`,
    `font-src 'self'`,
    `connect-src 'self' ${supabase}${isDev ? " ws: wss:" : ""}`.trim(),
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  /**
   * Request headers carrying the nonce, rebuilt at each response so that cookie
   * rotation performed above is reflected. Next reads `Content-Security-Policy`
   * off the *request* to find the nonce it should stamp onto its script tags.
   */
  const forwardedHeaders = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return headers;
  };

  /** Applied to every response, including redirects. */
  const harden = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  // With no Supabase project configured there is no session to refresh and no
  // meaningful way to sign in. Send everything to the setup screen, which
  // explains what to add, rather than to a login form that cannot work.
  if (!isSupabaseConfigured()) {
    const options = { request: { headers: forwardedHeaders() } };
    if (pathname === "/setup") return harden(NextResponse.next(options));
    const url = request.nextUrl.clone();
    url.pathname = "/setup";
    url.search = "";
    return harden(NextResponse.rewrite(url, options));
  }

  let response = NextResponse.next({ request: { headers: forwardedHeaders() } });

  const supabase = createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request: { headers: forwardedHeaders() } });
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
    return harden(NextResponse.redirect(url));
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return harden(NextResponse.redirect(url));
  }

  return harden(response);
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
