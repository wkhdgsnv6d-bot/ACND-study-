import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Server-side Supabase client.
 *
 * Uses the **anon key plus the signed-in user's session cookie**, never the
 * service-role key. That is deliberate: every query therefore runs as the
 * `authenticated` role and row-level security is genuinely enforced by the
 * database rather than by application code remembering to filter by user.
 *
 * Note that `cookies()` is async in Next 16 — synchronous access was removed.
 */
export async function createClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. This is expected and safe:
          // `proxy.ts` refreshes the session on every request, so the write
          // that matters has already happened before rendering begins.
        }
      },
    },
  });
}

/**
 * The current user, or null.
 *
 * Always uses `getUser()`, which validates the JWT against Supabase, rather
 * than `getSession()`, which trusts a cookie the browser could have forged.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/**
 * Like `getCurrentUser`, but for code paths that cannot meaningfully continue
 * without one. Route protection lives in `proxy.ts`; this is the second line of
 * defence for server actions and route handlers, which proxy rules can miss.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
