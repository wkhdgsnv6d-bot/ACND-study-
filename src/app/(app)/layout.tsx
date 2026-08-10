import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * Authenticated application layout.
 *
 * `proxy.ts` already redirects unauthenticated requests, but this check stays
 * as defence in depth: proxy matchers are easy to get subtly wrong, and the
 * cost of being wrong here is rendering someone's business data.
 */

/**
 * Every route beneath this layout renders per-request.
 *
 * Without this, a page that happens not to touch cookies on a given build —
 * which is exactly what happens when Supabase is unconfigured — gets
 * prerendered at build time and then serves that frozen HTML to real sessions.
 * Authenticated surfaces must never be static.
 */
export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = supabase
    ? await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <AppShell
      userEmail={user.email ?? null}
      displayName={(profile as { display_name?: string | null } | null)?.display_name ?? null}
    >
      {children}
    </AppShell>
  );
}
