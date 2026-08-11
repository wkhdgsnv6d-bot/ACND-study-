import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Lock } from "lucide-react";

import { Card, CardBody } from "@/components/common/card";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { EmptyState, ErrorState } from "@/components/common/states";
import { StatusPill } from "@/components/common/status-pill";
import { SKILLS } from "@/lib/domain/skills";
import { evaluateTermLock } from "@/lib/engines/unlock";
import { getCourseOverview } from "@/lib/queries/course";
import { getProgressSnapshot } from "@/lib/queries/progress";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Course" };

export default async function CoursePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [overview, dashboard] = await Promise.all([
    getCourseOverview(user),
    getProgressSnapshot(user),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="My Course"
        description="Four terms, from beginner to founder. Progress counts published lessons only — draft content never makes a module look unfinished."
      />

      {overview.error ? (
        <ErrorState className="mt-6" description={overview.error} />
      ) : null}

      {overview.terms.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={BookOpen}
          title="No curriculum yet"
          description="Terms appear here as their content is written."
        />
      ) : (
        <div className="mt-8 space-y-4">
          {overview.terms.map((termProgress) => {
            const { term } = termProgress;
            const lock = evaluateTermLock(term.number, dashboard.term4);
            const skills = [
              ...new Set(term.modules.flatMap((m) => m.frontmatter.skills)),
            ];

            return (
              <Card key={term.path} className={lock.locked ? "opacity-75" : undefined}>
                <CardBody className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={lock.locked ? "neutral" : "primary"}>
                          Term {term.number}
                        </StatusPill>
                        {lock.locked ? (
                          <StatusPill tone="warning">
                            <Lock className="size-3" aria-hidden />
                            Locked
                          </StatusPill>
                        ) : null}
                        <span className="text-xs text-subtle-foreground">
                          {term.modules.length} module
                          {term.modules.length === 1 ? "" : "s"}
                          {termProgress.gradableCount > 0
                            ? ` · ${termProgress.gradableCount} published lesson${termProgress.gradableCount === 1 ? "" : "s"}`
                            : " · content in progress"}
                        </span>
                      </div>

                      <h2 className="mt-2.5 text-lg font-semibold tracking-tight text-balance">
                        {term.frontmatter.title}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground text-pretty">
                        {term.frontmatter.summary}
                      </p>

                      {skills.length > 0 ? (
                        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                          {skills.map((key) => (
                            <li
                              key={key}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground"
                            >
                              <span
                                aria-hidden
                                className="size-1.5 rounded-full"
                                style={{
                                  backgroundColor: `var(${SKILLS[key].colorToken})`,
                                }}
                              />
                              {SKILLS[key].name}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <div className="shrink-0">
                      {lock.locked ? (
                        <p className="max-w-56 text-xs text-muted-foreground italic text-pretty">
                          {lock.reason}
                        </p>
                      ) : (
                        <Link
                          href={`/course/${term.slug}`}
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          Open term
                          <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      )}
                    </div>
                  </div>

                  {termProgress.gradableCount > 0 ? (
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">
                          {termProgress.completedCount} of {termProgress.gradableCount}{" "}
                          lessons complete
                        </span>
                        <span className="font-mono text-subtle-foreground tabular-nums">
                          {Math.round(termProgress.fraction * 100)}%
                        </span>
                      </div>
                      <ProgressBar
                        label={`${term.frontmatter.title} progress`}
                        value={termProgress.fraction}
                        size="sm"
                        tone={termProgress.fraction === 1 ? "success" : "primary"}
                      />
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
