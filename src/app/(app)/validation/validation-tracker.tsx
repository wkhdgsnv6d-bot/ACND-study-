"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";

import {
  deleteValidationInterview,
  saveValidationInterview,
} from "@/app/(app)/business-actions";
import { RecordForm, Select } from "@/components/business/record-form";
import { Card, CardBody } from "@/components/common/card";
import { EmptyState } from "@/components/common/states";
import { StatusPill, type PillTone } from "@/components/common/status-pill";
import { Field, Input, Textarea } from "@/components/ui/field";
import { formatCurrency } from "@/lib/engines/finance";
import type { ValidationRow } from "@/lib/queries/business";

const URGENCY_TONE: Record<string, PillTone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "danger",
};

export function ValidationTracker({
  interviews,
  currency,
}: {
  interviews: ValidationRow[];
  currency: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <RecordForm
        title="Record a conversation"
        addLabel="Record a conversation"
        action={saveValidationInterview}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business" required>
            {(props) => <Input {...props} name="business" />}
          </Field>
          <Field label="Industry">
            {(props) => <Input {...props} name="industry" />}
          </Field>
          <Field label="Who you spoke to">
            {(props) => <Input {...props} name="contact" />}
          </Field>
          <Select
            name="urgency"
            label="Urgency"
            defaultValue="medium"
            options={[
              { value: "low", label: "Low — interesting, not painful" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical — costing them now" },
            ]}
          />
        </div>

        <Field
          label="Problem discovered"
          description="Their words, not your interpretation."
        >
          {(props) => <Textarea {...props} name="problemDiscovered" rows={3} />}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How they handle it now">
            {(props) => <Textarea {...props} name="currentSolution" rows={2} />}
          </Field>
          <Field
            label="What it costs them"
            description="Hours, dollars, lost jobs — the number that separates an interesting problem from an expensive one."
          >
            {(props) => <Textarea {...props} name="costOfProblem" rows={2} />}
          </Field>
          <Field label="Potential service">
            {(props) => <Input {...props} name="potentialService" />}
          </Field>
          <Field label={`Estimated value (${currency})`}>
            {(props) => (
              <Input {...props} name="estimatedValue" type="number" min={0} defaultValue={0} />
            )}
          </Field>
        </div>

        <Field label="Follow-up">
          {(props) => <Input {...props} name="followUp" />}
        </Field>
        <Field label="Notes">
          {(props) => <Textarea {...props} name="notes" rows={2} />}
        </Field>
      </RecordForm>

      {interviews.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Five of these is a Term 1 requirement, and they happen early on purpose — discovering nobody nearby wants what you are learning costs a few awkward calls in week three and six months in month six."
        />
      ) : (
        <ul className="space-y-3">
          {interviews.map((interview) => (
            <li key={interview.id}>
              <Card>
                <CardBody className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{interview.business}</h3>
                        {interview.urgency ? (
                          <StatusPill tone={URGENCY_TONE[interview.urgency] ?? "neutral"}>
                            {interview.urgency}
                          </StatusPill>
                        ) : null}
                        {interview.estimatedValueCents > 0 ? (
                          <span className="font-mono text-xs text-subtle-foreground">
                            {formatCurrency(interview.estimatedValueCents, { currency })}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-subtle-foreground">
                        {interview.industry ? <span>{interview.industry}</span> : null}
                        {interview.contact ? <span>{interview.contact}</span> : null}
                        <time dateTime={interview.conductedAt}>
                          {new Date(interview.conductedAt).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                          })}
                        </time>
                      </div>

                      {interview.problemDiscovered ? (
                        <p className="mt-2 text-sm text-muted-foreground text-pretty">
                          {interview.problemDiscovered}
                        </p>
                      ) : null}

                      {interview.costOfProblem ? (
                        <p className="mt-1.5 text-xs text-warning text-pretty">
                          Costs them: {interview.costOfProblem}
                        </p>
                      ) : null}

                      {interview.followUp ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Follow-up: {interview.followUp}
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Delete ${interview.business}`}
                      onClick={() =>
                        startTransition(async () => {
                          await deleteValidationInterview(interview.id);
                        })
                      }
                      className="shrink-0 rounded p-1 text-subtle-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
