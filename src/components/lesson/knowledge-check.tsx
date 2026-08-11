"use client";

import { CheckCircle2, CircleHelp, RotateCcw, XCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { submitQuiz, type QuizResult } from "@/app/(app)/course/actions";
import { Card, CardBody, CardHeader } from "@/components/common/card";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import type { ClientQuestion } from "@/lib/quiz";
import { cn } from "@/lib/utils";

/**
 * Knowledge check.
 *
 * Questions arrive with `correct` and `why` stripped — grading happens on the
 * server. The explanations come back with the result, which is when they are
 * most useful anyway: every option is explained, not just the right one, so a
 * wrong answer teaches why it was wrong rather than only that it was.
 *
 * Open questions cannot be machine-graded. They are shown with their rubric and
 * a model answer for honest self-assessment, and are excluded from the score
 * rather than counted as free marks.
 */

const TYPE_LABELS: Record<string, string> = {
  "multiple-choice": "Multiple choice",
  "multi-select": "Select all that apply",
  scenario: "Scenario",
  debugging: "Debugging",
  architecture: "Architecture decision",
  "code-interpretation": "Code interpretation",
  "short-answer": "Short answer",
  "client-simulation": "Client simulation",
};

export function KnowledgeCheck({
  lessonPath,
  questions,
  previousBest,
}: {
  lessonPath: string;
  questions: ClientQuestion[];
  previousBest: { scorePercent: number; passed: boolean; attempts: number } | null;
}) {
  const [answers, setAnswers] = useState<Record<string, number[] | string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [pending, startTransition] = useTransition();

  const gradable = questions.filter((q) => !q.open);
  const answered = gradable.filter((q) => (answers[q.id] as number[])?.length > 0);
  const allAnswered = answered.length === gradable.length;

  function toggle(question: ClientQuestion, index: number) {
    if (result) return;
    setAnswers((current) => {
      const existing = (current[question.id] as number[]) ?? [];
      if (question.multiple) {
        const next = existing.includes(index)
          ? existing.filter((i) => i !== index)
          : [...existing, index].sort((a, b) => a - b);
        return { ...current, [question.id]: next };
      }
      return { ...current, [question.id]: [index] };
    });
  }

  function onSubmit() {
    startTransition(async () => {
      const outcome = await submitQuiz({ lessonPath, answers });
      setResult(outcome);
      // Bring the score into view rather than leaving the reader at the bottom.
      document.getElementById("knowledge-check")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  function retry() {
    setAnswers({});
    setResult(null);
  }

  return (
    <Card id="knowledge-check" className="mt-12 scroll-mt-20">
      <CardHeader
        title="Knowledge check"
        description={
          result
            ? "Every option is explained — including the ones you did not pick."
            : `${gradable.length} graded question${gradable.length === 1 ? "" : "s"}${
                questions.length > gradable.length
                  ? ` and ${questions.length - gradable.length} for self-assessment`
                  : ""
              }. 80% to pass.`
        }
        action={
          result ? (
            <StatusPill tone={result.passed ? "success" : "warning"}>
              {result.scorePercent}%
            </StatusPill>
          ) : previousBest ? (
            <StatusPill tone={previousBest.passed ? "success" : "neutral"}>
              Best {previousBest.scorePercent}%
            </StatusPill>
          ) : null
        }
      />

      <CardBody className="space-y-8">
        {result?.message ? (
          <p className="text-sm text-destructive">{result.message}</p>
        ) : null}

        {questions.map((question, questionIndex) => {
          const outcome = result?.results.find((r) => r.questionId === question.id);
          const chosen = (answers[question.id] as number[]) ?? [];

          return (
            <fieldset key={question.id} className="min-w-0">
              <legend className="mb-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-mono text-xs text-subtle-foreground">
                  {String(questionIndex + 1).padStart(2, "0")}
                </span>
                <span className="text-xs text-subtle-foreground">
                  {TYPE_LABELS[question.type] ?? question.type}
                </span>
                {outcome && question.open ? (
                  <StatusPill tone="info">Self-assessed</StatusPill>
                ) : outcome ? (
                  <StatusPill tone={outcome.correct ? "success" : "danger"}>
                    {outcome.correct ? "Correct" : "Incorrect"}
                  </StatusPill>
                ) : null}
              </legend>

              <p className="text-sm font-medium text-pretty">{question.prompt}</p>

              {question.code ? (
                <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-1 p-3 font-mono text-xs leading-6">
                  <code>{question.code}</code>
                </pre>
              ) : null}

              {question.open ? (
                <OpenQuestion
                  question={question}
                  value={(answers[question.id] as string) ?? ""}
                  onChange={(value) =>
                    setAnswers((current) => ({ ...current, [question.id]: value }))
                  }
                  outcome={outcome}
                  locked={Boolean(result)}
                />
              ) : (
                <ul className="mt-3 space-y-2">
                  {(question.options ?? []).map((text, index) => {
                    const picked = chosen.includes(index);
                    const revealed = outcome?.options?.[index];

                    return (
                      <li key={index}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                            !result && "border-border hover:bg-surface-2",
                            !result && picked && "border-primary/40 bg-primary-muted",
                            revealed?.correct && "border-success/40 bg-success-muted",
                            revealed &&
                              !revealed.correct &&
                              picked &&
                              "border-destructive/40 bg-destructive-muted",
                            revealed &&
                              !revealed.correct &&
                              !picked &&
                              "border-border opacity-70",
                            result && "cursor-default",
                          )}
                        >
                          <input
                            type={question.multiple ? "checkbox" : "radio"}
                            name={question.id}
                            checked={picked}
                            disabled={Boolean(result)}
                            onChange={() => toggle(question, index)}
                            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="text-pretty">{text}</span>
                            {revealed ? (
                              <span
                                className={cn(
                                  "mt-1.5 flex items-start gap-1.5 text-xs",
                                  revealed.correct
                                    ? "text-success"
                                    : "text-muted-foreground",
                                )}
                              >
                                {revealed.correct ? (
                                  <CheckCircle2
                                    className="mt-0.5 size-3 shrink-0"
                                    aria-hidden
                                  />
                                ) : (
                                  <XCircle className="mt-0.5 size-3 shrink-0" aria-hidden />
                                )}
                                <span className="min-w-0 text-pretty">{revealed.why}</span>
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
          );
        })}

        {result ? (
          <ResultSummary result={result} onRetry={retry} />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={onSubmit} disabled={!allAnswered || pending} aria-busy={pending}>
              {pending ? "Marking…" : "Submit answers"}
            </Button>
            {!allAnswered ? (
              <p className="text-xs text-subtle-foreground">
                {answered.length} of {gradable.length} answered
              </p>
            ) : null}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function OpenQuestion({
  question,
  value,
  onChange,
  outcome,
  locked,
}: {
  question: ClientQuestion;
  value: string;
  onChange: (value: string) => void;
  outcome?: { rubric?: string[]; modelAnswer?: string };
  locked: boolean;
}) {
  return (
    <div className="mt-3">
      <label htmlFor={`answer-${question.id}`} className="sr-only">
        Your answer
      </label>
      <Textarea
        id={`answer-${question.id}`}
        value={value}
        disabled={locked}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Answer as you would on a call…"
        rows={4}
      />

      {outcome?.rubric ? (
        <div className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <CircleHelp className="size-3.5 shrink-0 text-info" aria-hidden />
            Mark your own answer against these
          </p>
          <ul className="mt-2 space-y-1.5">
            {outcome.rubric.map((criterion) => (
              <li key={criterion} className="text-xs text-muted-foreground text-pretty">
                • {criterion}
              </li>
            ))}
          </ul>
          {outcome.modelAnswer ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-primary hover:underline">
                Show a model answer
              </summary>
              <p className="mt-2 text-xs text-muted-foreground text-pretty">
                {outcome.modelAnswer}
              </p>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ResultSummary({
  result,
  onRetry,
}: {
  result: QuizResult;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {result.passed
              ? `Passed with ${result.scorePercent}%`
              : `${result.scorePercent}% — below the 80% pass mark`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Attempt {result.attemptNumber}
            {result.xpAwarded > 0 ? ` · +${result.xpAwarded} XP` : ""}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCcw />
          Try again
        </Button>
      </div>

      {result.scheduledForReview.length > 0 ? (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground text-pretty">
          <strong className="text-foreground">
            {result.scheduledForReview.length} concept
            {result.scheduledForReview.length === 1 ? "" : "s"} scheduled for review:
          </strong>{" "}
          {result.scheduledForReview.join(", ").replaceAll("-", " ")}. A wrong answer is
          the clearest signal the platform gets about what has not landed yet, so these
          come back in a few days rather than being forgotten.
        </p>
      ) : null}
    </div>
  );
}
