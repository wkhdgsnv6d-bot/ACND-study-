import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Circle, FileText, Lock } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/common/card";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { StatusPill } from "@/components/common/status-pill";
import { MdxContent } from "@/components/mdx/mdx-content";
import { getModuleSource, loadCurriculum } from "@/lib/content/loader";
import { SKILLS } from "@/lib/domain/skills";
import { buildModuleProgress, getCourseOverview } from "@/lib/queries/course";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateStaticParams() {
  const { curriculum } = loadCurriculum();
  return [...curriculum.modulesByPath.values()].map((mod) => ({
    term: mod.termSlug,
    module: mod.slug,
  }));
}

export async function generateMetadata(
  props: PageProps<"/course/[term]/[module]">,
): Promise<Metadata> {
  const { term, module: moduleSlug } = await props.params;
  const source = getModuleSource(`${term}/${moduleSlug}`);
  return { title: source?.module.frontmatter.title ?? "Module" };
}

export default async function ModulePage(
  props: PageProps<"/course/[term]/[module]">,
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { term: termSlug, module: moduleSlug } = await props.params;
  const source = getModuleSource(`${termSlug}/${moduleSlug}`);
  if (!source) notFound();

  const { module: mod, body } = source;
  const { curriculum } = loadCurriculum();
  const term = curriculum.terms.find((t) => t.slug === termSlug);

  const overview = await getCourseOverview(user);
  const progress = buildModuleProgress(mod, overview.completedLessons);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center text-sm">
        <Link href="/course" className="text-muted-foreground hover:text-foreground">
          My Course
        </Link>
        <span className="mx-2 text-subtle-foreground" aria-hidden>
          /
        </span>
        <Link
          href={`/course/${termSlug}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Term {term?.number ?? ""}
        </Link>
        <span className="mx-2 text-subtle-foreground" aria-hidden>
          /
        </span>
        <span className="min-w-0 truncate text-foreground">
          {mod.frontmatter.title}
        </span>
      </nav>

      <PageHeader
        title={mod.frontmatter.title}
        description={mod.frontmatter.summary}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            {mod.frontmatter.skills.map((key) => (
              <StatusPill key={key} tone="neutral">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: `var(${SKILLS[key].colorToken})` }}
                />
                {SKILLS[key].name}
              </StatusPill>
            ))}
          </div>
        }
      />

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
            label={`${mod.frontmatter.title} progress`}
            value={progress.fraction}
            tone={progress.fraction === 1 ? "success" : "primary"}
          />
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          {body.trim().length > 0 ? <MdxContent source={body} /> : null}

          <h2 className="mt-10 mb-3 text-sm font-semibold tracking-tight">Lessons</h2>

          {mod.lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No lessons written for this module yet.
            </p>
          ) : (
            <ol className="space-y-2">
              {mod.lessons.map((lesson, index) => {
                const draft = lesson.frontmatter.status === "draft";
                const done = overview.completedLessons.has(lesson.path);
                const blocked = lesson.frontmatter.prerequisites.some(
                  (p) => !overview.completedLessons.has(p),
                );

                const inner = (
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">
                      {done ? (
                        <CheckCircle2 className="size-4 text-success" aria-hidden />
                      ) : blocked ? (
                        <Lock className="size-4 text-subtle-foreground" aria-hidden />
                      ) : (
                        <Circle className="size-4 text-subtle-foreground" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-mono text-xs text-subtle-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-sm font-medium">
                          {lesson.frontmatter.title}
                        </span>
                        {draft ? (
                          <StatusPill tone="neutral">Draft</StatusPill>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
                        {lesson.frontmatter.summary}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-subtle-foreground">
                        <span>{lesson.frontmatter.duration} min</span>
                        <span className="capitalize">
                          {lesson.frontmatter.difficulty}
                        </span>
                        {lesson.frontmatter.quiz.length > 0 ? (
                          <span>
                            {lesson.frontmatter.quiz.length} question
                            {lesson.frontmatter.quiz.length === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {lesson.frontmatter.practicalTask ? (
                          <span>Practical task</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );

                return (
                  <li key={lesson.path}>
                    {draft ? (
                      <div
                        className="cursor-not-allowed rounded-xl border border-dashed border-border px-4 py-3 opacity-60"
                        title="This lesson has not been written yet"
                      >
                        {inner}
                      </div>
                    ) : (
                      <Link
                        href={`/course/${termSlug}/${moduleSlug}/${lesson.slug}`}
                        className="block rounded-xl border border-border px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface-2"
                      >
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="What you will be able to do" />
            <CardBody>
              <ul className="space-y-2">
                {mod.frontmatter.objectives.map((objective) => (
                  <li
                    key={objective}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2
                      className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground"
                      aria-hidden
                    />
                    <span className="min-w-0 text-pretty">{objective}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {mod.frontmatter.exam ? (
            <Card>
              <CardHeader title="Module exam" />
              <CardBody>
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 text-pretty">
                    {mod.frontmatter.exam.questionCount} questions sampled from this
                    module, {mod.frontmatter.exam.passMark}% to pass
                    {mod.frontmatter.exam.timeLimitMinutes
                      ? `, ${mod.frontmatter.exam.timeLimitMinutes} minutes`
                      : ""}
                    .
                  </span>
                </p>
                <p className="mt-3 text-xs text-subtle-foreground">
                  Exams arrive later in Phase 3.
                </p>
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
