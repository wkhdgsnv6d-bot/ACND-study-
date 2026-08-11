import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ValidationTracker } from "@/app/(app)/validation/validation-tracker";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { ErrorState } from "@/components/common/states";
import { getValidationInterviews } from "@/lib/queries/business";
import { getSettings } from "@/lib/queries/settings";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Market Validation" };

const TARGET = 5;

export default async function ValidationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [{ rows, error }, settings] = await Promise.all([
    getValidationInterviews(user),
    getSettings(user),
  ]);

  const expensive = rows.filter(
    (r) => r.urgency === "high" || r.urgency === "critical",
  ).length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Market validation"
        description="Conversations with real businesses about real problems. The point is to separate interesting problems from expensive ones — only the second kind gets paid for."
      />

      {error ? <ErrorState className="mt-6" description={error} /> : null}

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Conversations"
          value={rows.length}
          hint={`${TARGET} required for Term 1`}
          tone={rows.length >= TARGET ? "success" : "muted"}
        />
        <StatCard
          label="Expensive problems"
          value={expensive}
          hint="High or critical urgency"
        />
        <StatCard
          label="With a follow-up"
          value={rows.filter((r) => r.followUp).length}
        />
      </section>

      <div className="mt-6">
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
          <span className="text-muted-foreground">
            Term 1 milestone: {Math.min(rows.length, TARGET)} of {TARGET}
          </span>
          <span className="font-mono text-subtle-foreground tabular-nums">
            {Math.round((Math.min(rows.length, TARGET) / TARGET) * 100)}%
          </span>
        </div>
        <ProgressBar
          label="Market validation conversations toward the Term 1 milestone"
          value={Math.min(rows.length, TARGET) / TARGET}
          tone={rows.length >= TARGET ? "success" : "primary"}
        />
      </div>

      <div className="mt-8">
        <ValidationTracker interviews={rows} currency={settings.currency} />
      </div>
    </div>
  );
}
