import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Circle, ClipboardList, FileEdit } from "lucide-react";

import { Card, CardBody } from "@/components/common/card";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/states";
import { StatusPill, type PillTone } from "@/components/common/status-pill";
import { SKILLS } from "@/lib/domain/skills";
import {
  getAssignments,
  type SubmissionStatus,
} from "@/lib/queries/assignments";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Assignments" };

const STATUS_META: Record<SubmissionStatus, { label: string; tone: PillTone }> = {
  "not-started": { label: "Not started", tone: "neutral" },
  draft: { label: "Draft", tone: "warning" },
  submitted: { label: "Submitted", tone: "info" },
  approved: { label: "Submitted", tone: "success" },
  needs_improvement: { label: "Needs work", tone: "danger" },
};

export default async function AssignmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getAssignments(user);
  const live = data.items.filter((item) => !item.lessonDraft);
  const upcoming = data.items.filter((item) => item.lessonDraft);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Assignments"
        description="The practical work across the curriculum. This is the evidence that lifts a skill past Practised — lessons alone never will."
      />

      {data.error ? <ErrorState className="mt-6" description={data.error} /> : null}

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Submitted"
          value={`${data.approvedCount}/${live.length}`}
          hint="Published tasks"
          tone={data.approvedCount > 0 ? "success" : "muted"}
        />
        <StatCard
          label="XP earned"
          value={data.totalXpEarned.toLocaleString()}
          hint={`of ${data.totalXpAvailable.toLocaleString()} available`}
        />
        <StatCard
          label="Awaiting you"
          value={live.length - data.approvedCount}
          hint="Tasks not yet submitted"
        />
      </section>

      <h2 className="mt-10 mb-3 text-sm font-semibold tracking-tight">Available now</h2>

      {live.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No practical tasks published yet"
          description="Tasks appear here as lessons are finished. Each one asks you to build or do something and record the evidence."
        />
      ) : (
        <ul className="space-y-3">
          {live.map((item) => {
            const meta = STATUS_META[item.status];
            const done = item.status === "approved";

            return (
              <li key={item.ref}>
                <Card>
                  <CardBody className="py-4">
                    <div className="flex items-start gap-3.5">
                      <span className="mt-0.5 shrink-0">
                        {done ? (
                          <CheckCircle2 className="size-5 text-success" aria-hidden />
                        ) : item.status === "draft" ? (
                          <FileEdit className="size-5 text-warning" aria-hidden />
                        ) : (
                          <Circle className="size-5 text-subtle-foreground" aria-hidden />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold tracking-tight">
                            {item.task.title}
                          </h3>
                          <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                        </div>

                        <p className="mt-1 text-sm text-muted-foreground text-pretty">
                          {item.task.brief}
                        </p>

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-subtle-foreground">
                          <span>Term {item.termNumber}</span>
                          <span className="min-w-0 truncate">{item.moduleTitle}</span>
                          <span>~{item.task.estimatedMinutes} min</span>
                          <span>+{item.task.xp} XP</span>
                          <span>
                            {item.task.rubric.length} criteria ·{" "}
                            {item.task.evidence.join(", ").replaceAll("-", " ")}
                          </span>
                          {item.skills.length > 0 ? (
                            <span className="flex items-center gap-1.5">
                              {item.skills.map((key) =>
                                SKILLS[key] ? (
                                  <span
                                    key={key}
                                    title={SKILLS[key].name}
                                    aria-label={SKILLS[key].name}
                                    className="size-1.5 rounded-full"
                                    style={{
                                      backgroundColor: `var(${SKILLS[key].colorToken})`,
                                    }}
                                  />
                                ) : null,
                              )}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <Link
                        href={item.href}
                        className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary"
                        aria-label={`Open ${item.task.title}`}
                      >
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {upcoming.length > 0 ? (
        <>
          <h2 className="mt-10 mb-3 text-sm font-semibold tracking-tight">
            In draft lessons
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            These tasks exist but their lessons are still being written, so they do not
            count toward anything yet.
          </p>
          <ul className="space-y-2">
            {upcoming.map((item) => (
              <li
                key={item.ref}
                className="rounded-xl border border-dashed border-border px-4 py-3 opacity-60"
              >
                <p className="text-sm font-medium">{item.task.title}</p>
                <p className="mt-0.5 text-xs text-subtle-foreground">
                  Term {item.termNumber} · {item.moduleTitle}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
