"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Browser Supabase client, for the few interactions that must happen client
 * side — sign-in, sign-out and auth state changes.
 *
 * Everything that reads or writes your data goes through server components and
 * server actions instead, so query logic and business rules never ship to the
 * browser. Only the anon key is used here, and row-level security means that
 * key alone grants access to nothing without a valid session.
 */

let cached: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  cached ??= createBrowserClient(env.supabaseUrl!, env.supabaseAnonKey!);
  return cached;
}
