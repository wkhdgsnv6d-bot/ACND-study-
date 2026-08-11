"use client";

import { CheckCircle2, ClipboardCheck, Link2 } from "lucide-react";
import { useState, useTransition } from "react";

import { savePracticalTask } from "@/app/(app)/course/actions";
import { Card, CardBody, CardHeader } from "@/components/common/card";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { EvidenceKind, PracticalTask } from "@/lib/content/schema";

/**
 * The practical task — where a lesson stops being reading.
 *
 * Rubric criteria are ticked individually rather than by a single "done"
 * checkbox, and the required evidence is genuinely required: the server rejects
 * a submission with an unticked criterion or a missing link.
 *
 * This is self-attested, and the platform says so. What it will not do is let
 * you skip a step without noticing.
 */

export interface PracticalSubmissionState {
  status: "draft" | "submitted" | "approved" | "needs_improvement";
  rubricCheck: Record<string, boolean>;
  evidence: {
    repoUrl?: string;
    liveUrl?: string;
    externalUrl?: string;
    screenshots?: string[];
    writeUp?: string;
  };
}

const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  "repo-url": "Repository URL",
  "live-url": "Live URL",
  "external-url": "Link",
  screenshot: "Screenshot URL",
  file: "File",
  written: "Written account",
};

export function PracticalTaskPanel({
  lessonPath,
  task,
  existing,
}: {
  lessonPath: string;
  task: PracticalTask;
  existing: PracticalSubmissionState | null;
}) {
  const [rubricCheck, setRubricCheck] = useState<Record<string, boolean>>(
    existing?.rubricCheck ?? {},
  );
  const [repoUrl, setRepoUrl] = useState(existing?.evidence.repoUrl ?? "");
  const [liveUrl, setLiveUrl] = useState(existing?.evidence.liveUrl ?? "");
  const [externalUrl, setExternalUrl] = useState(existing?.evidence.externalUrl ?? "");
  const [screenshot, setScreenshot] = useState(
    existing?.evidence.screenshots?.[0] ?? "",
  );
  const [writeUp, setWriteUp] = useState(existing?.evidence.writeUp ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [approved, setApproved] = useState(existing?.status === "approved");
  const [pending, startTransition] = useTransition();

  const tickedCount = task.rubric.filter((c) => rubricCheck[c]).length;
  const allTicked = tickedCount === task.rubric.length;

  function payload(submit: boolean) {
    return {
      lessonPath,
      rubricCheck,
      evidence: {
        repoUrl: repoUrl.trim() || undefined,
        liveUrl: liveUrl.trim() || undefined,
        externalUrl: externalUrl.trim() || undefined,
        screenshots: screenshot.trim() ? [screenshot.trim()] : [],
        writeUp: writeUp.trim() || undefined,
      },
      submit,
    };
  }

  function run(submit: boolean) {
    setMessage(null);
    startTransition(async () => {
      const result = await savePracticalTask(payload(submit));
      setMessage(result.message);
      if (result.ok && submit) setApproved(true);
    });
  }

  return (
    <Card className="mt-10 scroll-mt-20" id="practical-task" elevated>
      <CardHeader
        title="Practical task"
        description="Reading is the weakest evidence the platform accepts. This is the strong kind."
        action={
          approved ? (
            <StatusPill tone="success">
              <CheckCircle2 className="size-3" aria-hidden />
              Submitted
            </StatusPill>
          ) : (
            <StatusPill tone="primary">+{task.xp} XP</StatusPill>
          )
        }
      />

      <CardBody className="space-y-6">
        <div>
          <h3 className="text-sm font-medium">{task.title}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
            {task.brief}
          </p>
          <p className="mt-2 text-xs text-subtle-foreground">
            About {task.estimatedMinutes} minutes
          </p>
        </div>

        <fieldset>
          <legend className="mb-2 flex items-center gap-1.5 text-xs font-medium">
            <ClipboardCheck className="size-3.5 shrink-0" aria-hidden />
            You are done when
            <span className="font-mono text-subtle-foreground">
              {tickedCount}/{task.rubric.length}
            </span>
          </legend>
          <ul className="space-y-2">
            {task.rubric.map((criterion) => (
              <li key={criterion}>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(rubricCheck[criterion])}
                    disabled={approved}
                    onChange={(event) =>
                      setRubricCheck((current) => ({
                        ...current,
                        [criterion]: event.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 shrink-0 rounded border-border accent-[var(--primary)]"
                  />
                  <span className="min-w-0 text-muted-foreground text-pretty">
                    {criterion}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1 flex items-center gap-1.5 text-xs font-medium">
            <Link2 className="size-3.5 shrink-0" aria-hidden />
            Evidence
            <span className="font-normal text-subtle-foreground">
              — required, not optional
            </span>
          </legend>

          {task.evidence.includes("repo-url") ? (
            <Field label={EVIDENCE_LABELS["repo-url"]} required>
              {(props) => (
                <Input
                  {...props}
                  value={repoUrl}
                  disabled={approved}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/…"
                />
              )}
            </Field>
          ) : null}

          {task.evidence.includes("live-url") ? (
            <Field label={EVIDENCE_LABELS["live-url"]} required>
              {(props) => (
                <Input
                  {...props}
                  value={liveUrl}
                  disabled={approved}
                  onChange={(e) => setLiveUrl(e.target.value)}
                  placeholder="https://…"
                />
              )}
            </Field>
          ) : null}

          {task.evidence.includes("external-url") ? (
            <Field label={EVIDENCE_LABELS["external-url"]} required>
              {(props) => (
                <Input
                  {...props}
                  value={externalUrl}
                  disabled={approved}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://…"
                />
              )}
            </Field>
          ) : null}

          {task.evidence.includes("screenshot") ? (
            <Field
              label={EVIDENCE_LABELS.screenshot}
              description="Paste a link to an image. File upload arrives with the projects portfolio."
              required
            >
              {(props) => (
                <Input
                  {...props}
                  value={screenshot}
                  disabled={approved}
                  onChange={(e) => setScreenshot(e.target.value)}
                  placeholder="https://…"
                />
              )}
            </Field>
          ) : null}

          {task.evidence.includes("written") ? (
            <Field
              label={EVIDENCE_LABELS.written}
              description="What you did, what went wrong, and how you resolved it. At least a few sentences."
              required
            >
              {(props) => (
                <Textarea
                  {...props}
                  value={writeUp}
                  disabled={approved}
                  onChange={(e) => setWriteUp(e.target.value)}
                  rows={5}
                />
              )}
            </Field>
          ) : null}
        </fieldset>

        {approved ? (
          <p className="rounded-lg border border-success/25 bg-success-muted px-3 py-2.5 text-xs text-muted-foreground text-pretty">
            Submitted and recorded. This counts as practical evidence toward the skill
            branches this lesson advances — the kind that lifts a skill past Practised.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => run(true)} disabled={pending} aria-busy={pending}>
              {pending ? "Submitting…" : "Submit task"}
            </Button>
            <Button variant="secondary" onClick={() => run(false)} disabled={pending}>
              Save draft
            </Button>
            {!allTicked ? (
              <p className="text-xs text-subtle-foreground">
                All criteria must be ticked to submit
              </p>
            ) : null}
          </div>
        )}

        {message ? (
          <p
            role="status"
            className={
              approved ? "text-xs text-success" : "text-xs text-destructive"
            }
          >
            {message}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
