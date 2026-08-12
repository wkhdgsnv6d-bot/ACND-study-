import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Circle, Lock } from "lucide-react";

import { Card, CardBody } from "@/components/common/card";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { ErrorState } from "@/components/common/states";
import { StatusPill } from "@/components/common/status-pill";
import { MdxContent } from "@/components/mdx/mdx-content";
import { getTermSource, loadCurriculum } from "@/lib/content/loader";
import { SKILLS } from "@/lib/domain/skills";
import { evaluateTermLock } from "@/lib/engines/unlock";
import { buildTermProgress, getCourseOverview } from "@/lib/queries/course";
import { getProgressSnapshot } from "@/lib/queries/progress";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateStaticParams() {
  const { curriculum } = loadCurriculum();
  return curriculum.terms.map((term) => ({ term: term.slug }));
}

export async function generateMetadata(
  props: PageProps<"/course/[term]">,
): Promise<Metadata> {
  const { term: termSlug } = await props.params;
  const source = getTermSource(termSlug);
  return { title: source?.term.frontmatter.title ?? "Term" };
}

export default async function TermPage(props: PageProps<"/course/[term]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { term: termSlug } = await props.params;
  const source = getTermSource(termSlug);
  if (!source) notFound();

  const { term, body } = source;

  const [overview, dashboard] = await Promise.all([
    getCourseOverview(user),
    getProgressSnapshot(user),
  ]);

  const lock = evaluateTermLock(term.number, dashboard.term4);
  const progress = buildTermProgress(term, overview.completedLessons);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link href="/course" className="text-muted-foreground hover:text-foreground">
          My Course
        </Link>
        <span className="mx-2 text-subtle-foreground" aria-hidden>
          /
        </span>
        <span className="text-foreground">Term {term.number}</span>
      </nav>

      <PageHeader
        eyebrow={<StatusPill tone="primary">{term.frontmatter.subtitle}</StatusPill>}
        title={term.frontmatter.title}
        description={term.frontmatter.objective}
      />

      {overview.error ? (
        <ErrorState className="mt-6" description={overview.error} />
      ) : null}

      {lock.locked ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-muted px-5 py-4">
          <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-warning">This term is locked</p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              {lock.reason}
            </p>
            <Link
              href="/settings#unlocks"
              className="mt-2 inline-block text-xs text-primary hover:underline"
            >
              Review the unlock thresholds
            </Link>
          </div>
        </div>
      ) : null}

      {progress.gradableCount > 0 ? (
        <div className="mt-6">
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {progress.completedCount} of {progress.gradableCount} lessons complete
            </span>
            <span className="font-mono text-xs text-subtle-foreground tabular-nums">
              {Math.round(progress.fraction * 100)}%
            </span>
          </div>
          <ProgressBar
            label={`${term.frontmatter.title} progress`}
            value={progress.fraction}
            tone={progress.fraction === 1 ? "success" : "primary"}
          />
        </div>
      ) : null}

      {body.trim().length > 0 ? (
        <div className="mt-10 max-w-none">
          <MdxContent source={body} />
        </div>
      ) : null}

      <h2 className="mt-12 mb-4 text-sm font-semibold tracking-tight">Modules</h2>

      <ol className="space-y-3">
        {progress.modules.map((moduleProgress, index) => {
          const mod = moduleProgress.module;
          const done =
            moduleProgress.gradableCount > 0 &&
            moduleProgress.completedCount === moduleProgress.gradableCount;

          return (
            <li key={mod.path}>
              <Card className={lock.locked ? "opacity-60" : undefined}>
                <CardBody className="py-4">
                  <div className="flex items-start gap-3.5">
                    <span className="mt-0.5 shrink-0">
                      {done ? (
                        <CheckCircle2 className="size-5 text-success" aria-hidden />
                      ) : (
                        <Circle className="size-5 text-subtle-foreground" aria-hidden />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <span className="font-mono text-xs text-subtle-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="text-sm font-semibold tracking-tight">
                          {mod.frontmatter.title}
                        </h3>
                        {moduleProgress.gradableCount === 0 ? (
                          <StatusPill tone="neutral">Content in progress</StatusPill>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm text-muted-foreground text-pretty">
                        {mod.frontmatter.summary}
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-subtle-foreground">
                        {moduleProgress.gradableCount > 0 ? (
                          <span>
                            {moduleProgress.completedCount}/
                            {moduleProgress.gradableCount} lessons
                          </span>
                        ) : null}
                        {moduleProgress.remainingMinutes > 0 ? (
                          <span>{moduleProgress.remainingMinutes} min remaining</span>
                        ) : null}
                        {mod.frontmatter.exam ? (
                          <span>Exam · {mod.frontmatter.exam.passMark}% to pass</span>
                        ) : null}
                        <span className="flex items-center gap-1.5">
                          {mod.frontmatter.skills.map((key) => (
                            <span
                              key={key}
                              role="img"
                              aria-label={SKILLS[key].name}
                              title={SKILLS[key].name}
                              className="size-1.5 rounded-full"
                              style={{
                                backgroundColor: `var(${SKILLS[key].colorToken})`,
                              }}
                            />
                          ))}
                        </span>
                      </div>

                      {moduleProgress.gradableCount > 0 ? (
                        <ProgressBar
                          className="mt-3"
                          size="sm"
                          label={`${mod.frontmatter.title} progress`}
                          value={moduleProgress.fraction}
                          tone={done ? "success" : "primary"}
                        />
                      ) : null}
                    </div>

                    {!lock.locked ? (
                      <Link
                        href={`/course/${term.slug}/${mod.slug}`}
                        className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary"
                        aria-label={`Open ${mod.frontmatter.title}`}
                      >
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
