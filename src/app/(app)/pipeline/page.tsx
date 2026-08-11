import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PipelineBoard } from "@/app/(app)/pipeline/pipeline-board";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { formatCurrency } from "@/lib/engines/finance";
import { FUNNEL_STAGES, STAGE_LABELS } from "@/lib/domain/pipeline";
import { getProspects } from "@/lib/queries/business";
import { getSettings } from "@/lib/queries/settings";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Client Pipeline" };

export default async function PipelinePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [{ rows, error }, settings] = await Promise.all([
    getProspects(user),
    getSettings(user),
  ]);

  const contacted = rows.filter((p) => p.stage !== "lead").length;
  const replied = rows.filter((p) =>
    ["replied", "discovery_booked", "qualified", "proposal_sent", "negotiation", "won", "onboarding", "delivery", "completed", "recurring"].includes(p.stage),
  ).length;
  const won = rows.filter((p) =>
    ["won", "onboarding", "delivery", "completed", "recurring"].includes(p.stage),
  ).length;
  const openValue = rows
    .filter((p) => !["won", "lost", "completed", "recurring"].includes(p.stage))
    .reduce((sum, p) => sum + p.estimatedValueCents, 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Client pipeline"
        description="Thirteen stages from lead to recurring. Each stage represents the prospect's commitment rather than your activity — which is what makes the funnel forecastable."
      />

      {error ? <ErrorState className="mt-6" description={error} /> : null}

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Contacted" value={contacted} hint={`${rows.length} total`} />
        <StatCard
          label="Replied"
          value={replied}
          hint={contacted > 0 ? `${Math.round((replied / contacted) * 100)}% reply rate` : undefined}
        />
        <StatCard
          label="Clients won"
          value={won}
          tone={won > 0 ? "success" : "muted"}
          hint={contacted > 0 ? `${Math.round((won / contacted) * 100)}% close rate` : undefined}
        />
        <StatCard
          label="Open value"
          value={formatCurrency(openValue, { currency: settings.currency })}
        />
      </section>

      <section className="mt-6" aria-label="Funnel">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {FUNNEL_STAGES.map((stage) => {
            const count = rows.filter((p) => p.stage === stage).length;
            return (
              <li
                key={stage}
                className="min-w-0 rounded-lg border border-border bg-surface-2 px-2.5 py-2"
              >
                <div className="truncate text-xs text-muted-foreground">
                  {STAGE_LABELS[stage]}
                </div>
                <div className="mt-0.5 font-mono text-sm tabular-nums">{count}</div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-8">
        <PipelineBoard prospects={rows} currency={settings.currency} />
      </div>
    </div>
  );
}
