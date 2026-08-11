"use client";

import { ChevronRight, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import {
  deleteProspect,
  moveProspect,
  saveProspect,
} from "@/app/(app)/business-actions";
import { RecordForm, Select } from "@/components/business/record-form";
import { Card, CardBody } from "@/components/common/card";
import { EmptyState } from "@/components/common/states";
import { StatusPill } from "@/components/common/status-pill";
import { Field, Input, Textarea } from "@/components/ui/field";
import { formatCurrency } from "@/lib/engines/finance";
import {
  PROSPECT_STAGES,
  STAGE_LABELS,
  type ProspectStage,
} from "@/lib/domain/pipeline";
import type { ProspectRow } from "@/lib/queries/business";
import { cn } from "@/lib/utils";

/**
 * The client pipeline.
 *
 * Stages represent the *prospect's* commitment, not your activity — which is
 * what makes the funnel forecastable. Moving a prospect forward records the
 * corresponding business milestone automatically, because a milestone driven
 * by a record is worth something and a milestone driven by a button is not.
 */

const STAGE_TONE: Partial<Record<ProspectStage, "success" | "warning" | "danger">> = {
  won: "success",
  recurring: "success",
  completed: "success",
  lost: "danger",
  negotiation: "warning",
  proposal_sent: "warning",
};

export function PipelineBoard({
  prospects,
  currency,
}: {
  prospects: ProspectRow[];
  currency: string;
}) {
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"open" | "all" | "closed">("open");

  const openStages: ProspectStage[] = [
    "lead",
    "contacted",
    "replied",
    "discovery_booked",
    "qualified",
    "proposal_sent",
    "negotiation",
  ];
  const closedStages: ProspectStage[] = ["won", "lost", "onboarding", "delivery", "completed", "recurring"];

  const visibleStages =
    filter === "open" ? openStages : filter === "closed" ? closedStages : PROSPECT_STAGES;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {(["open", "closed", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
              filter === value
                ? "border-primary/40 bg-primary-muted text-primary"
                : "border-border text-muted-foreground hover:bg-surface-2",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <RecordForm title="New prospect" addLabel="Add prospect" action={saveProspect}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company" required>
            {(props) => <Input {...props} name="company" />}
          </Field>
          <Field label="Contact name">
            {(props) => <Input {...props} name="contactName" />}
          </Field>
          <Field label="Contact email">
            {(props) => <Input {...props} name="contactEmail" type="email" />}
          </Field>
          <Field label="Industry">
            {(props) => <Input {...props} name="industry" />}
          </Field>
          <Field label="Source" description="How they found you, or how you found them.">
            {(props) => <Input {...props} name="source" />}
          </Field>
          <Select
            name="stage"
            label="Stage"
            defaultValue="lead"
            required
            options={PROSPECT_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
          />
          <Field label="Service">
            {(props) => (
              <Input {...props} name="service" placeholder="Growth package" />
            )}
          </Field>
          <Field label={`Estimated value (${currency})`}>
            {(props) => (
              <Input {...props} name="estimatedValue" type="number" min={0} defaultValue={0} />
            )}
          </Field>
          <Field label={`Expected MRR (${currency})`}>
            {(props) => (
              <Input {...props} name="mrr" type="number" min={0} defaultValue={0} />
            )}
          </Field>
          <Field label="Expected close">
            {(props) => <Input {...props} name="expectedCloseOn" type="date" />}
          </Field>
          <Field label="Next action">
            {(props) => (
              <Input {...props} name="nextAction" placeholder="Send the proposal" />
            )}
          </Field>
          <Field label="Next action due">
            {(props) => <Input {...props} name="nextActionDue" type="date" />}
          </Field>
        </div>
        <Field label="Notes">
          {(props) => <Textarea {...props} name="notes" rows={2} />}
        </Field>
      </RecordForm>

      {prospects.length === 0 ? (
        <EmptyState
          title="No prospects yet"
          description="Add the first business you intend to approach. The funnel numbers on the dashboard come from here."
        />
      ) : (
        <div className="space-y-6">
          {visibleStages.map((stage) => {
            const inStage = prospects.filter((p) => p.stage === stage);
            if (inStage.length === 0) return null;

            const value = inStage.reduce((sum, p) => sum + p.estimatedValueCents, 0);

            return (
              <section key={stage}>
                <div className="mb-2 flex flex-wrap items-baseline gap-2">
                  <h2 className="text-sm font-semibold tracking-tight">
                    {STAGE_LABELS[stage]}
                  </h2>
                  <span className="font-mono text-xs text-subtle-foreground">
                    {inStage.length}
                  </span>
                  {value > 0 ? (
                    <span className="text-xs text-subtle-foreground">
                      {formatCurrency(value, { currency })} in play
                    </span>
                  ) : null}
                </div>

                <ul className="space-y-2">
                  {inStage.map((prospect) => {
                    const index = PROSPECT_STAGES.indexOf(prospect.stage);
                    const next = PROSPECT_STAGES[index + 1];

                    return (
                      <li key={prospect.id}>
                        <Card>
                          <CardBody className="py-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {prospect.company}
                                  </span>
                                  <StatusPill tone={STAGE_TONE[prospect.stage] ?? "neutral"}>
                                    {STAGE_LABELS[prospect.stage]}
                                  </StatusPill>
                                  {prospect.estimatedValueCents > 0 ? (
                                    <span className="font-mono text-xs text-subtle-foreground">
                                      {formatCurrency(prospect.estimatedValueCents, {
                                        currency,
                                      })}
                                    </span>
                                  ) : null}
                                  {prospect.mrrCents > 0 ? (
                                    <span className="font-mono text-xs text-success">
                                      +{formatCurrency(prospect.mrrCents, { currency })}
                                      /mo
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-subtle-foreground">
                                  {prospect.contactName ? (
                                    <span>{prospect.contactName}</span>
                                  ) : null}
                                  {prospect.industry ? <span>{prospect.industry}</span> : null}
                                  {prospect.service ? <span>{prospect.service}</span> : null}
                                  {prospect.source ? <span>via {prospect.source}</span> : null}
                                </div>

                                {prospect.nextAction ? (
                                  <p className="mt-1.5 text-xs text-muted-foreground">
                                    Next: {prospect.nextAction}
                                    {prospect.nextActionDue
                                      ? ` — due ${prospect.nextActionDue}`
                                      : ""}
                                  </p>
                                ) : null}
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                {next ? (
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                      startTransition(async () => {
                                        await moveProspect(prospect.id, next);
                                      })
                                    }
                                    className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                                  >
                                    {STAGE_LABELS[next]}
                                    <ChevronRight className="size-3" aria-hidden />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  aria-label={`Delete ${prospect.company}`}
                                  onClick={() =>
                                    startTransition(async () => {
                                      await deleteProspect(prospect.id);
                                    })
                                  }
                                  className="rounded p-1 text-subtle-foreground transition-colors hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" aria-hidden />
                                </button>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
