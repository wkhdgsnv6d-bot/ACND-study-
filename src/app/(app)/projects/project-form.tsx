"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteProject,
  PROJECT_IDLE,
  saveProject,
} from "@/app/(app)/projects/actions";
import { Card, CardBody, CardHeader } from "@/components/common/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SKILLS, SKILL_KEYS, type SkillKey } from "@/lib/domain/skills";

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: "planning" | "in_progress" | "complete" | "archived";
  skills: SkillKey[];
  tech: string[];
  repoUrl: string | null;
  liveUrl: string | null;
  screenshots: string[];
  lessonsLearned: string | null;
  problemsEncountered: string | null;
  howISolvedThem: string | null;
  clientReady: boolean;
  portfolioReady: boolean;
}

const STATUSES = [
  { value: "planning", label: "Planning" },
  { value: "in_progress", label: "In progress" },
  { value: "complete", label: "Complete" },
  { value: "archived", label: "Archived" },
] as const;

export function ProjectForm({
  project,
  onDone,
}: {
  project?: ProjectRow;
  onDone?: () => void;
}) {
  const [state, action] = useActionState(saveProject, PROJECT_IDLE);
  const [clientReady, setClientReady] = useState(project?.clientReady ?? false);

  return (
    <form
      action={async (formData) => {
        await action(formData);
        onDone?.();
      }}
      className="space-y-4"
      noValidate
    >
      {project ? <input type="hidden" name="id" value={project.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={state.fieldErrors?.name} required>
          {(props) => (
            <Input {...props} name="name" defaultValue={project?.name ?? ""} />
          )}
        </Field>

        <Field label="Status" error={state.fieldErrors?.status} required>
          {(props) => (
            <select
              {...props}
              name="status"
              defaultValue={project?.status ?? "planning"}
              className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <Field label="Description" error={state.fieldErrors?.description}>
        {(props) => (
          <Textarea
            {...props}
            name="description"
            rows={2}
            defaultValue={project?.description ?? ""}
            placeholder="What it is and who it was for."
          />
        )}
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Skills this project demonstrates
        </legend>
        <p className="mb-2 text-xs text-muted-foreground">
          Only tick branches this project genuinely provides evidence for — these
          counts decide whether a skill can pass Practised.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {SKILL_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                name="skills"
                value={key}
                defaultChecked={project?.skills.includes(key)}
                className="size-3.5 rounded border-border accent-[var(--primary)]"
              />
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: `var(${SKILLS[key].colorToken})` }}
              />
              {SKILLS[key].name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Repository URL" error={state.fieldErrors?.repoUrl}>
          {(props) => (
            <Input
              {...props}
              name="repoUrl"
              defaultValue={project?.repoUrl ?? ""}
              placeholder="https://github.com/…"
            />
          )}
        </Field>
        <Field label="Live URL" error={state.fieldErrors?.liveUrl}>
          {(props) => (
            <Input
              {...props}
              name="liveUrl"
              defaultValue={project?.liveUrl ?? ""}
              placeholder="https://…"
            />
          )}
        </Field>
        <Field label="Screenshot URL" error={state.fieldErrors?.screenshot}>
          {(props) => (
            <Input
              {...props}
              name="screenshot"
              defaultValue={project?.screenshots[0] ?? ""}
              placeholder="https://…"
            />
          )}
        </Field>
        <Field
          label="Technology"
          description="Comma separated."
          error={state.fieldErrors?.tech}
        >
          {(props) => (
            <Input
              {...props}
              name="tech"
              defaultValue={project?.tech.join(", ") ?? ""}
              placeholder="Next.js, Supabase, n8n"
            />
          )}
        </Field>
      </div>

      <Field
        label="What you learned"
        description="Required for a client-ready project. The part that makes this evidence rather than a screenshot."
        error={state.fieldErrors?.lessonsLearned}
      >
        {(props) => (
          <Textarea
            {...props}
            name="lessonsLearned"
            rows={3}
            defaultValue={project?.lessonsLearned ?? ""}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Problems encountered" error={state.fieldErrors?.problemsEncountered}>
          {(props) => (
            <Textarea
              {...props}
              name="problemsEncountered"
              rows={3}
              defaultValue={project?.problemsEncountered ?? ""}
            />
          )}
        </Field>
        <Field label="How you solved them" error={state.fieldErrors?.howISolvedThem}>
          {(props) => (
            <Textarea
              {...props}
              name="howISolvedThem"
              rows={3}
              defaultValue={project?.howISolvedThem ?? ""}
            />
          )}
        </Field>
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="clientReady"
            defaultChecked={project?.clientReady}
            onChange={(e) => setClientReady(e.target.checked)}
            className="mt-0.5 size-4 rounded border-border accent-[var(--primary)]"
          />
          <span className="min-w-0 text-muted-foreground">
            <strong className="text-foreground">Client ready</strong> — you would put
            this in front of a paying client and support it. Required for a skill to
            reach Mastered.
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="portfolioReady"
            defaultChecked={project?.portfolioReady}
            className="mt-0.5 size-4 rounded border-border accent-[var(--primary)]"
          />
          <span className="min-w-0 text-muted-foreground">
            <strong className="text-foreground">Portfolio ready</strong> — good enough
            to show a prospect.
          </span>
        </label>
      </div>

      {clientReady ? (
        <p className="rounded-lg border border-warning/25 bg-warning-muted px-3 py-2 text-xs text-muted-foreground text-pretty">
          Client ready is a claim with weight — it is what lets a branch reach Mastered.
          A written account of what you learned is required before it will save.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <SaveButton isNew={!project} />
        {state.message ? (
          <span
            role="status"
            className={
              state.status === "success"
                ? "text-xs text-success"
                : "text-xs text-destructive"
            }
          >
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
      {pending ? "Saving…" : isNew ? "Add project" : "Save changes"}
    </Button>
  );
}

export function NewProjectPanel() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add project
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader
        title="New project"
        action={
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        }
      />
      <CardBody>
        <ProjectForm onDone={() => setOpen(false)} />
      </CardBody>
    </Card>
  );
}

export function DeleteProjectButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="Delete project"
        className="rounded p-1 text-subtle-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => void (await deleteProject(id)))}
        className="text-destructive hover:underline"
      >
        {pending ? "Deleting…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-muted-foreground hover:underline"
      >
        Cancel
      </button>
    </span>
  );
}
