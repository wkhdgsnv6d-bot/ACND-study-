import { z } from "zod";

/**
 * Environment access, with deliberate graceful degradation.
 *
 * The platform must build, boot and be developable **without any credentials**.
 * That is not a convenience — it is what allows the design system, the
 * curriculum and every pure engine to be worked on before a Supabase project
 * exists, and it means a missing variable produces an explanatory setup screen
 * rather than a stack trace.
 *
 * So this module never throws at import time. It reports what is configured and
 * lets each caller decide what to do about it.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

/**
 * Read explicitly rather than from a loop over `process.env`. Next.js inlines
 * `NEXT_PUBLIC_*` at build time only for statically analysable member access,
 * so dynamic lookups silently return undefined in the browser.
 */
const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

export const env = {
  supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

/** True when Supabase is configured well enough to authenticate and query. */
export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

/**
 * Which variables are missing, for the setup screen. Returns names only —
 * never values, so this is safe to render.
 */
export function missingSupabaseVars(): string[] {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}

/**
 * Server-only secrets.
 *
 * Accessed through a function rather than a module constant so that a
 * mistaken import from a client component fails loudly at call time instead of
 * quietly inlining `undefined`. None of these may ever be prefixed with
 * `NEXT_PUBLIC_`.
 */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error(
      "serverEnv() was called in the browser. Server secrets must never reach client code.",
    );
    }

  return {
    /** Bypasses row-level security entirely. Migrations and admin scripts only. */
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    databaseUrl: process.env.DATABASE_URL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  } as const;
}

export function isAssistantConfigured(): boolean {
  if (typeof window !== "undefined") return false;
  return Boolean(serverEnv().anthropicApiKey);
}
