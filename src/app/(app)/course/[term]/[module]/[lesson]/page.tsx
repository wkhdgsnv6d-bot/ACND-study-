import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookMarked,
  ExternalLink,
  Lock,
  Target,
} from "lucide-react";

import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { Card, CardBody, CardHeader } from "@/components/common/card";
import { ErrorState } from "@/components/common/states";
import { StatusPill } from "@/components/common/status-pill";
import { KnowledgeCheck } from "@/components/lesson/knowledge-check";
import { NotesPanel } from "@/components/lesson/notes-panel";
import { PracticalTaskPanel } from "@/components/lesson/practical-task";
import { ReadingProgress } from "@/components/lesson/reading-progress";
import { MdxContent } from "@/components/mdx/mdx-content";
import {
  getAdjacentLessons,
  getLessonSource,
  loadCurriculum,
} from "@/lib/content/loader";
import { SKILLS } from "@/lib/domain/skills";
import { isAssistantConfigured } from "@/lib/env";
import { getLessonPageData } from "@/lib/queries/course";
import { toClientQuestions } from "@/lib/quiz";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateStaticParams() {
  const { curriculum } = loadCurriculum();
  return [...curriculum.lessonsByPath.values()]
    .filter((lesson) => lesson.frontmatter.status === "complete")
    .map((lesson) => ({
      term: lesson.termSlug,
      module: lesson.moduleSlug,
      lesson: lesson.slug,
    }));
}

export async function generateMetadata(
  props: PageProps<"/course/[term]/[module]/[lesson]">,
): Promise<Metadata> {
  const { term, module: mod, lesson } = await props.params;
  const source = getLessonSource(`${term}/${mod}/${lesson}`);
  if (!source) return { title: "Lesson" };
  return {
    title: source.lesson.frontmatter.title,
    description: source.lesson.frontmatter.summary,
  };
}

export default async function LessonPage(
  props: PageProps<"/course/[term]/[module]/[lesson]">,
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { term: termSlug, module: moduleSlug, lesson: lessonSlug } = await props.params;
  const path = `${termSlug}/${moduleSlug}/${lessonSlug}`;
  const source = getLessonSource(path);
  if (!source) notFound();

  const { lesson, body } = source;
  const fm = lesson.frontmatter;
  const { curriculum } = loadCurriculum();
  const mod = curriculum.modulesByPath.get(`${termSlug}/${moduleSlug}`);
  const { previous, next } = getAdjacentLessons(path);

  const data = await getLessonPageData(user, lesson);
  const href = `/course/${termSlug}/${moduleSlug}/${lessonSlug}`;

  const bestAttempt = data.attempts.reduce<null | {
    scorePercent: number;
    passed: boolean;
  }>(
    (best, attempt) =>
      !best || attempt.scorePercent > best.scorePercent
        ? { scorePercent: attempt.scorePercent, passed: attempt.passed }
        : best,
    null,
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center text-sm">
        <Link href="/course" className="text-muted-foreground hover:text-foreground">
          My Course
        </Link>
        <Separator />
        <Link
          href={`/course/${termSlug}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Term {lesson.termNumber}
        </Link>
        <Separator />
        <Link
          href={`/course/${termSlug}/${moduleSlug}`}
          className="min-w-0 truncate text-muted-foreground hover:text-foreground"
        >
          {mod?.frontmatter.title}
        </Link>
      </nav>

      {data.error ? <ErrorState className="mb-6" description={data.error} /> : null}

      {data.lock.locked ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-muted px-5 py-4">
          <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-warning">
              This lesson builds on earlier material
            </p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              {data.lock.reason}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_17rem]">
        {/* ---------------------------------------------------------- */}
        <div className="min-w-0">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              {fm.status === "draft" ? (
                <StatusPill tone="warning">Draft — not yet finished</StatusPill>
              ) : null}
              <StatusPill tone="neutral">{fm.duration} min</StatusPill>
              <StatusPill tone="neutral">
                <span className="capitalize">{fm.difficulty}</span>
              </StatusPill>
              {Object.keys(fm.skillXp).map((key) => {
                const skill = SKILLS[key as keyof typeof SKILLS];
                if (!skill) return null;
                return (
                  <StatusPill key={key} tone="neutral">
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: `var(${skill.colorToken})` }}
                    />
                    {skill.name}
                  </StatusPill>
                );
              })}
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance">
              {fm.title}
            </h1>
            <p className="mt-3 text-lg text-muted-foreground text-pretty">
              {fm.summary}
            </p>
          </header>

          <Card className="mt-8">
            <CardHeader title="By the end of this lesson you can" />
            <CardBody>
              <ul className="space-y-2">
                {fm.objectives.map((objective) => (
                  <li key={objective} className="flex items-start gap-2.5 text-sm">
                    <Target
                      className="mt-0.5 size-3.5 shrink-0 text-primary"
                      aria-hidden
                    />
                    <span className="min-w-0 text-muted-foreground text-pretty">
                      {objective}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <article id="lesson-body" className="mt-10">
            <MdxContent source={body} />
          </article>

          {fm.securityNote ? (
            <aside className="mt-10 overflow-hidden rounded-xl border border-destructive/35">
              <div className="flex items-center gap-2 border-b border-destructive/25 bg-destructive-muted px-4 py-2">
                <AlertTriangle
                  className="size-4 shrink-0 text-destructive"
                  aria-hidden
                />
                <p className="text-sm font-semibold text-destructive">
                  Before you go further
                </p>
              </div>
              <p className="bg-destructive-muted/40 px-4 py-3.5 text-sm text-muted-foreground text-pretty">
                {fm.securityNote}
              </p>
            </aside>
          ) : null}

          {fm.commonMistakes.length > 0 ? (
            <Card className="mt-10">
              <CardHeader
                title="Common mistakes"
                description="Worth reading before you make them rather than after."
              />
              <CardBody>
                <ul className="space-y-5">
                  {fm.commonMistakes.map((mistake) => (
                    <li key={mistake.mistake}>
                      <p className="text-sm font-medium text-destructive">
                        {mistake.mistake}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground text-pretty">
                        {mistake.correction}
                      </p>
                      {mistake.why ? (
                        <p className="mt-1 text-xs text-subtle-foreground text-pretty">
                          Why it happens: {mistake.why}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {fm.practicalTask ? (
            <PracticalTaskPanel
              lessonPath={lesson.path}
              task={fm.practicalTask}
              existing={data.practical}
            />
          ) : null}

          {fm.quiz.length > 0 ? (
            <KnowledgeCheck
              lessonPath={lesson.path}
              questions={toClientQuestions(fm.quiz)}
              previousBest={
                bestAttempt
                  ? { ...bestAttempt, attempts: data.attempts.length }
                  : null
              }
            />
          ) : null}

          <nav className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            {previous ? (
              <Link
                href={`/course/${previous.termSlug}/${previous.moduleSlug}/${previous.slug}`}
                className="group min-w-0 flex-1"
              >
                <span className="flex items-center gap-1.5 text-xs text-subtle-foreground">
                  <ArrowLeft className="size-3" aria-hidden />
                  Previous
                </span>
                <span className="mt-0.5 block truncate text-sm text-muted-foreground group-hover:text-foreground">
                  {previous.frontmatter.title}
                </span>
              </Link>
            ) : (
              <span className="flex-1" />
            )}

            {next ? (
              <Link
                href={`/course/${next.termSlug}/${next.moduleSlug}/${next.slug}`}
                className="group min-w-0 flex-1 text-right"
              >
                <span className="flex items-center justify-end gap-1.5 text-xs text-subtle-foreground">
                  Next
                  <ArrowRight className="size-3" aria-hidden />
                </span>
                <span className="mt-0.5 block truncate text-sm text-muted-foreground group-hover:text-foreground">
                  {next.frontmatter.title}
                </span>
              </Link>
            ) : null}
          </nav>

          <ReadingProgress
            lessonPath={lesson.path}
            durationMinutes={fm.duration}
            initialSeconds={data.progress?.secondsSpent ?? 0}
            initialScroll={data.progress?.scrollCompletion ?? 0}
            alreadyComplete={data.progress?.status === "completed"}
            nextHref={
              next
                ? `/course/${next.termSlug}/${next.moduleSlug}/${next.slug}`
                : null
            }
          />
        </div>

        {/* ---------------------------------------------------------- */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          {fm.terminology.length > 0 ? (
            <Card>
              <CardHeader title="Key terms" />
              <CardBody>
                <dl className="space-y-3">
                  {fm.terminology.map((entry) => (
                    <div key={entry.term}>
                      <dt className="flex items-center gap-1.5 text-sm font-medium">
                        <BookMarked
                          className="size-3 shrink-0 text-subtle-foreground"
                          aria-hidden
                        />
                        {entry.term}
                      </dt>
                      <dd className="mt-0.5 text-xs text-muted-foreground text-pretty">
                        {entry.definition}
                      </dd>
                      {entry.plainEnglish ? (
                        <dd className="mt-1 text-xs text-subtle-foreground italic text-pretty">
                          {entry.plainEnglish}
                        </dd>
                      ) : null}
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          ) : null}

          {data.weakConcepts.length > 0 ? (
            <Card>
              <CardHeader
                title="Worth re-reading"
                description="Concepts you have got wrong here before."
              />
              <CardBody>
                <ul className="space-y-1.5">
                  {data.weakConcepts.map((concept) => (
                    <li key={concept} className="text-xs text-warning">
                      {concept.replaceAll("-", " ")}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <NotesPanel lessonPath={lesson.path} revalidate={href} notes={data.notes} />

          <AssistantPanel
            configured={isAssistantConfigured()}
            lessonPath={lesson.path}
            lessonTitle={fm.title}
          />

          {fm.resources.length > 0 ? (
            <Card>
              <CardHeader title="Resources" />
              <CardBody>
                <ul className="space-y-3">
                  {fm.resources.map((resource) => (
                    <li key={resource.url}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-start gap-1.5 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
                        <span className="min-w-0 text-pretty">{resource.label}</span>
                      </a>
                      {resource.note ? (
                        <p className="mt-0.5 ml-4.5 text-xs text-subtle-foreground text-pretty">
                          {resource.note}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Separator() {
  return (
    <span className="mx-2 text-subtle-foreground" aria-hidden>
      /
    </span>
  );
}
