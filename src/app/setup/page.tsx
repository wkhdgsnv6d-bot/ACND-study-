import type { Metadata } from "next";
import { Database, KeyRound, ShieldAlert, TerminalSquare } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/common/card";
import { StatusPill } from "@/components/common/status-pill";
import { missingSupabaseVars } from "@/lib/env";

export const metadata: Metadata = { title: "Setup" };

/** Per-request, so the CSP nonce from `proxy.ts` reaches the script tags. */
export const dynamic = "force-dynamic";

/**
 * Shown when Supabase is not configured. `proxy.ts` rewrites every route here
 * rather than presenting a sign-in form that cannot possibly work.
 *
 * This exists because the platform is designed to build and boot without
 * credentials — so the absence of them is a documented state with instructions,
 * not a crash.
 */
export default function SetupPage() {
  const missing = missingSupabaseVars();

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-6 py-16">
      <StatusPill tone="warning">Setup required</StatusPill>

      <h1 className="mt-5 text-3xl font-semibold tracking-tight">
        Connect your database
      </h1>
      <p className="mt-3 text-muted-foreground text-pretty">
        Ascend Business Mastery stores your progress, notes, pipeline and revenue
        in your own Supabase project. Everything except persistence works without
        it — but nothing can be saved until it is connected.
      </p>

      <Card className="mt-8">
        <CardHeader
          title="Missing environment variables"
          description="Add these to .env.local and restart the dev server."
        />
        <CardBody>
          {missing.length === 0 ? (
            <p className="text-sm text-success">
              All variables are present. Restart the server to pick them up.
            </p>
          ) : (
            <ul className="space-y-2">
              {missing.map((name) => (
                <li key={name} className="flex items-center gap-2.5">
                  <KeyRound className="size-4 shrink-0 text-warning" aria-hidden />
                  <code className="font-mono text-sm">{name}</code>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="How to get them" />
        <CardBody>
          <ol className="space-y-4 text-sm text-muted-foreground">
            <Step n={1} icon={Database}>
              Create a free project at{" "}
              <a
                href="https://supabase.com/dashboard"
                className="text-primary hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                supabase.com/dashboard
              </a>
              . Pick a region close to you — Sydney if you are in Australia.
            </Step>
            <Step n={2} icon={KeyRound}>
              Open <strong className="text-foreground">Project Settings → API</strong> and copy the
              project URL and the <code className="font-mono text-xs">anon</code> public key into{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            </Step>
            <Step n={3} icon={Database}>
              Open <strong className="text-foreground">Project Settings → Database</strong>, copy the
              connection string into <code className="font-mono text-xs">DATABASE_URL</code>, then run{" "}
              <code className="font-mono text-xs">npm run db:migrate</code> to create the tables and
              their row-level security policies.
            </Step>
            <Step n={4} icon={TerminalSquare}>
              Restart the dev server and create your account.
            </Step>
          </ol>
        </CardBody>
      </Card>

      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-muted px-5 py-4">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <p className="min-w-0 text-sm text-muted-foreground text-pretty">
          The <code className="font-mono text-xs">anon</code> key is safe in the browser — every
          table has row-level security, so it grants access to nothing without a
          valid session. The{" "}
          <strong className="text-foreground">service role key is not</strong>. Keep it out of
          client code, screenshots and chat windows, including chats with an AI
          assistant.
        </p>
      </div>
    </main>
  );
}

function Step({
  n,
  icon: Icon,
  children,
}: {
  n: number;
  icon: typeof Database;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 font-mono text-xs">
        {n}
      </span>
      <span className="min-w-0 flex-1 text-pretty">
        <Icon className="mr-1.5 inline size-3.5 -translate-y-px text-subtle-foreground" aria-hidden />
        {children}
      </span>
    </li>
  );
}
