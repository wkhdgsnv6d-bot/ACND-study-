"use client";

import { CheckCircle2, Lightbulb, ShieldCheck, XCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { submitLab, type LabSubmissionResult } from "@/app/(app)/labs/actions";
import { Card, CardBody, CardHeader } from "@/components/common/card";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import type { LabDefinition } from "@/lib/domain/labs";
import { cn } from "@/lib/utils";

/**
 * One runner for every lab kind.
 *
 * The alternative — a bespoke component per lab — is why most platforms have
 * three interactive exercises and then stop. Five kinds expressed as data
 * covers the whole specification's lab list, and adding a lab is a definition
 * rather than a pull request against the UI.
 */
export function LabRunner({
  lab,
  previouslySolved,
}: {
  lab: LabDefinition;
  previouslySolved: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [result, setResult] = useState<LabSubmissionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const locked = result?.solved ?? false;

  function set(id: string, value: string | string[]) {
    if (locked) return;
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  function onSubmit() {
    startTransition(async () => {
      setResult(await submitLab({ labId: lab.id, answers }));
      document.getElementById("lab-result")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  function reset() {
    setAnswers({});
    setResult(null);
  }

  const resultFor = (id: string) => result?.results.find((r) => r.id === id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="The situation"
          action={
            previouslySolved && !result ? (
              <StatusPill tone="success">Already solved</StatusPill>
            ) : null
          }
        />
        <CardBody>
          <p className="text-sm text-muted-foreground text-pretty">{lab.brief}</p>
        </CardBody>
      </Card>

      {lab.kind === "fix-config" ? (
        <>
          <CodePanel title="Current configuration" code={lab.context} />
          <FieldList
            fields={lab.fields}
            answers={answers}
            set={set}
            locked={locked}
            resultFor={resultFor}
            showGiven
          />
        </>
      ) : null}

      {lab.kind === "mapping" ? (
        <>
          <CodePanel title={lab.sourceLabel} code={lab.source} />
          <FieldList
            fields={lab.fields}
            answers={answers}
            set={set}
            locked={locked}
            resultFor={resultFor}
            placeholder="e.g. contact.email"
          />
        </>
      ) : null}

      {lab.kind === "classify" ? (
        <Card>
          <CardHeader
            title="Sort each one"
            description={lab.categories.map((c) => c.label).join(" · ")}
          />
          <CardBody className="space-y-4">
            {lab.items.map((item) => {
              const outcome = resultFor(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-lg border px-3 py-3",
                    outcome?.correct && "border-success/40 bg-success-muted",
                    outcome && !outcome.correct && "border-destructive/40 bg-destructive-muted",
                    !outcome && "border-border",
                  )}
                >
                  <p className="text-sm font-medium text-pretty">{item.label}</p>
                  {item.detail ? (
                    <p className="mt-1 font-mono text-xs text-subtle-foreground">
                      {item.detail}
                    </p>
                  ) : null}

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {lab.categories.map((category) => {
                      const picked = answers[item.id] === category.id;
                      return (
                        <button
                          key={category.id}
                          type="button"
                          disabled={locked}
                          onClick={() => set(item.id, category.id)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs transition-colors",
                            picked
                              ? "border-primary/40 bg-primary-muted text-primary"
                              : "border-border text-muted-foreground hover:bg-surface-2",
                            locked && "cursor-default",
                          )}
                        >
                          {category.label}
                        </button>
                      );
                    })}
                  </div>

                  {outcome ? <Explanation outcome={outcome} /> : null}
                </div>
              );
            })}
          </CardBody>
        </Card>
      ) : null}

      {lab.kind === "ordering" ? (
        <Card>
          <CardHeader
            title="Put these in order"
            description={`Number them 1 to ${lab.steps.length}.`}
          />
          <CardBody className="space-y-2">
            {lab.steps.map((step) => {
              const outcome = resultFor(step.id);
              return (
                <div
                  key={step.id}
                  className={cn(
                    "rounded-lg border px-3 py-2.5",
                    outcome?.correct && "border-success/40 bg-success-muted",
                    outcome && !outcome.correct && "border-destructive/40 bg-destructive-muted",
                    !outcome && "border-border",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <label className="sr-only" htmlFor={`order-${step.id}`}>
                      Position for {step.label}
                    </label>
                    <Input
                      id={`order-${step.id}`}
                      type="number"
                      min={1}
                      max={lab.steps.length}
                      disabled={locked}
                      value={(answers[step.id] as string) ?? ""}
                      onChange={(e) => set(step.id, e.target.value)}
                      className="h-8 w-16 shrink-0 text-center font-mono"
                    />
                    <span className="min-w-0 text-sm">{step.label}</span>
                    {outcome ? (
                      <span className="ml-auto shrink-0 font-mono text-xs text-subtle-foreground">
                        {outcome.correct ? "✓" : `→ ${step.position}`}
                      </span>
                    ) : null}
                  </div>
                  {outcome ? <Explanation outcome={outcome} /> : null}
                </div>
              );
            })}
          </CardBody>
        </Card>
      ) : null}

      {lab.kind === "spot-the-flaw" ? (
        <Card>
          <CardHeader
            title="Select every problematic line"
            description={`There are ${lab.flaws.length}. Selecting clean lines counts against you.`}
          />
          <CardBody>
            <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
              {lab.code.split("\n").map((line, index) => {
                const number = index + 1;
                const selected = ((answers.selected as string[]) ?? []).includes(
                  String(number),
                );
                const flaw = lab.flaws.find((f) => f.line === number);
                const revealed = Boolean(result);

                return (
                  <button
                    key={number}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      const current = (answers.selected as string[]) ?? [];
                      set(
                        "selected",
                        current.includes(String(number))
                          ? current.filter((n) => n !== String(number))
                          : [...current, String(number)],
                      );
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-0.5 text-left font-mono text-xs transition-colors",
                      !revealed && selected && "bg-primary-muted",
                      !revealed && !selected && "hover:bg-surface-2",
                      revealed && flaw && "bg-destructive-muted",
                      revealed && !flaw && selected && "bg-warning-muted",
                    )}
                  >
                    <span className="w-6 shrink-0 text-right text-subtle-foreground select-none">
                      {number}
                    </span>
                    <span className="min-w-0 flex-1 whitespace-pre">{line || " "}</span>
                    {revealed && flaw ? (
                      <span className="shrink-0 text-destructive">●</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {result ? (
              <ul className="mt-4 space-y-3">
                {result.results.map((outcome) => (
                  <li
                    key={outcome.id}
                    className="rounded-lg border border-border px-3 py-2.5"
                  >
                    <p className="flex items-start gap-2 text-sm">
                      {outcome.correct ? (
                        <CheckCircle2
                          className="mt-0.5 size-3.5 shrink-0 text-success"
                          aria-hidden
                        />
                      ) : (
                        <XCircle
                          className="mt-0.5 size-3.5 shrink-0 text-destructive"
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0 font-medium text-pretty">
                        {outcome.label}
                      </span>
                    </p>
                    <p className="mt-1 ml-5.5 text-xs text-muted-foreground text-pretty">
                      {outcome.explanation}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {/* -------------------------------------------------------------- */}
      <div id="lab-result" className="scroll-mt-20">
        {result ? (
          <Card
            className={
              result.solved ? "border-success/40" : "border-warning/40"
            }
          >
            <CardBody className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {result.solved
                      ? "Solved"
                      : `${result.correctCount} of ${result.totalCount} correct`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Attempt {result.attemptNumber}
                    {result.xpAwarded > 0 ? ` · +${result.xpAwarded} XP` : ""}
                    {result.solved && result.xpAwarded === 0
                      ? " · already solved, no further XP"
                      : ""}
                  </p>
                </div>
                {!result.solved ? (
                  <Button variant="secondary" size="sm" onClick={reset}>
                    Try again
                  </Button>
                ) : null}
              </div>

              {result.inoculatesAgainst ? (
                <div className="mt-4 flex items-start gap-2.5 border-t border-border pt-4">
                  <ShieldCheck
                    className="mt-0.5 size-4 shrink-0 text-success"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium">What this lab was really about</p>
                    <p className="mt-1 text-sm text-muted-foreground text-pretty">
                      {result.inoculatesAgainst}
                    </p>
                  </div>
                </div>
              ) : null}

              {result.message ? (
                <p className="mt-3 text-xs text-destructive">{result.message}</p>
              ) : null}
            </CardBody>
          </Card>
        ) : (
          <Button onClick={onSubmit} disabled={pending} aria-busy={pending}>
            {pending ? "Checking…" : "Check my answers"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CodePanel({ title, code }: { title: string; code: string }) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface-1 p-3 font-mono text-xs leading-6">
          <code>{code}</code>
        </pre>
      </CardBody>
    </Card>
  );
}

function FieldList({
  fields,
  answers,
  set,
  locked,
  resultFor,
  showGiven = false,
  placeholder,
}: {
  fields: Array<{ id: string; label: string; given: string; hint?: string }>;
  answers: Record<string, string | string[]>;
  set: (id: string, value: string) => void;
  locked: boolean;
  resultFor: (id: string) => { correct: boolean; explanation: string } | undefined;
  showGiven?: boolean;
  placeholder?: string;
}) {
  return (
    <Card>
      <CardHeader title="Your answers" />
      <CardBody className="space-y-4">
        {fields.map((field) => {
          const outcome = resultFor(field.id);
          return (
            <div key={field.id}>
              <label
                htmlFor={`lab-${field.id}`}
                className="block text-sm font-medium text-pretty"
              >
                {field.label}
              </label>
              {showGiven ? (
                <p className="mt-0.5 text-xs text-subtle-foreground">
                  Currently: <code className="font-mono">{field.given}</code>
                </p>
              ) : null}

              <Input
                id={`lab-${field.id}`}
                value={(answers[field.id] as string) ?? ""}
                disabled={locked}
                onChange={(e) => set(field.id, e.target.value)}
                placeholder={placeholder}
                aria-invalid={outcome ? !outcome.correct : undefined}
                className="mt-1.5 font-mono"
              />

              {field.hint && !outcome ? (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-subtle-foreground">
                  <Lightbulb className="mt-0.5 size-3 shrink-0" aria-hidden />
                  <span className="min-w-0 text-pretty">{field.hint}</span>
                </p>
              ) : null}

              {outcome ? <Explanation outcome={outcome} /> : null}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function Explanation({
  outcome,
}: {
  outcome: { correct: boolean; explanation: string };
}) {
  return (
    <p
      className={cn(
        "mt-2 flex items-start gap-1.5 text-xs",
        outcome.correct ? "text-success" : "text-muted-foreground",
      )}
    >
      {outcome.correct ? (
        <CheckCircle2 className="mt-0.5 size-3 shrink-0" aria-hidden />
      ) : (
        <XCircle className="mt-0.5 size-3 shrink-0 text-destructive" aria-hidden />
      )}
      <span className="min-w-0 text-pretty">{outcome.explanation}</span>
    </p>
  );
}
