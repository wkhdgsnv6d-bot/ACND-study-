import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Clock,
  Flame,
  FlaskConical,
  Repeat2,
  Wrench,
} from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/common/card";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { ErrorState } from "@/components/common/states";
import { loadCurriculum } from "@/lib/content/loader";
import { getValidationInterviews } from "@/lib/queries/business";
import { getProgressSnapshot } from "@/lib/queries/progress";
import { getSettings } from "@/lib/queries/settings";
import {
  buildTodayPlan,
  findNextLab,
  findNextLesson,
  getReviewDeck,
  type TodayPlanItem,
} from "@/lib/queries/study";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Today" };

const ICONS: Record<TodayPlanItem["kind"], typeof BookOpen> = {
  lesson: BookOpen,
  review: Repeat2,
  lab: FlaskConical,
  practical: Wrench,
  business: Briefcase,
};

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [snapshot, deck, settings, validation] = await Promise.all([
    getProgressSnapshot(user),
    getReviewDeck(user),
    getSettings(user),
    getValidationInterviews(user),
  ]);

  const { curriculum } = loadCurriculum();
  const nextLesson = findNextLesson(snapshot.completedLessons);
  const nextLab = findNextLab(snapshot.solvedLabs);

  const outstandingPractical = [...curriculum.lessonsByPath.values()].find(
    (lesson) =>
      lesson.frontmatter.status === "complete" &&
      lesson.frontmatter.practicalTask &&
      snapshot.completedLessons.has(lesson.path) &&
      !snapshot.approvedSubmissions.has(lesson.path),
  );

  const plan = buildTodayPlan({
    targetMinutes: settings.dailyStudyTargetMinutes,
    dueReviewCount: deck.due.length,
    nextLessonPath: nextLesson
      ? `${nextLesson.termSlug}/${nextLesson.moduleSlug}/${nextLesson.slug}`
      : null,
    nextLessonTitle: nextLesson?.frontmatter.title ?? null,
    nextLessonMinutes: nextLesson?.frontmatter.duration ?? 0,
    unsolvedLabId: nextLab?.id ?? null,
    unsolvedLabTitle: nextLab?.title ?? null,
    unsolvedLabMinutes: nextLab?.estimatedMinutes ?? 0,
    outstandingPracticalPath: outstandingPractical
      ? `${outstandingPractical.termSlug}/${outstandingPractical.moduleSlug}/${outstandingPractical.slug}`
      : null,
    outstandingPracticalTitle:
      outstandingPractical?.frontmatter.practicalTask?.title ?? null,
    validationCount: validation.rows.length,
  });

  const planned = plan.reduce((sum, item) => sum + item.minutes, 0);
  const doneToday = snapshot.studyDays.find((d) => d.day === deck.today)?.minutes ?? 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Today"
        description={`${settings.dailyStudyTargetMinutes} minutes, ordered so the most perishable thing comes first.`}
      />

      {snapshot.error ? (
        <ErrorState className="mt-6" description={snapshot.error} />
      ) : null}

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Studied today"
          value={`${doneToday}m`}
          hint={`Target ${settings.dailyStudyTargetMinutes}m`}
          tone={doneToday >= settings.dailyStudyTargetMinutes ? "success" : "muted"}
        />
        <StatCard
          label="Streak"
          value={
            <span className="flex items-center gap-1.5">
              {snapshot.streak.current}
              {snapshot.streak.current > 0 ? (
                <Flame className="size-4 text-warning" aria-hidden />
              ) : null}
            </span>
          }
          hint={snapshot.streak.atRisk ? "At risk today" : `Best ${snapshot.streak.longest}`}
        />
        <StatCard label="Due for review" value={deck.due.length} />
        <StatCard label="Planned" value={`${planned}m`} />
      </section>

      <div className="mt-6">
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Toward today&apos;s target</span>
          <span className="font-mono text-subtle-foreground tabular-nums">
            {doneToday}/{settings.dailyStudyTargetMinutes}m
          </span>
        </div>
        <ProgressBar
          label="Study minutes toward today's target"
          value={doneToday / Math.max(1, settings.dailyStudyTargetMinutes)}
          tone={doneToday >= settings.dailyStudyTargetMinutes ? "success" : "primary"}
        />
      </div>

      {snapshot.streak.atRisk ? (
        <p className="mt-4 rounded-lg border border-warning/25 bg-warning-muted px-3 py-2.5 text-sm text-muted-foreground">
          Your {snapshot.streak.current}-day streak needs{" "}
          {snapshot.streak.minutesToSecureToday} more minutes today.
        </p>
      ) : null}

      <Card className="mt-8">
        <CardHeader
          title="The plan"
          description="Review first, because a concept about to fade is worth more than a new one."
        />
        <CardBody>
          {plan.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing scheduled — the curriculum has no published lessons left that you
              have not completed, and nothing is due for review.
            </p>
          ) : (
            <ol className="space-y-3">
              {plan.map((item, index) => {
                const Icon = ICONS[item.kind];
                return (
                  <li key={`${item.kind}-${index}`}>
                    <Link
                      href={item.href}
                      className="group flex items-start gap-3 rounded-lg border border-border px-3 py-3 transition-colors hover:border-border-strong hover:bg-surface-2"
                    >
                      <Icon
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-sm font-medium">{item.title}</span>
                          <span className="flex items-center gap-1 font-mono text-xs text-subtle-foreground">
                            <Clock className="size-3" aria-hidden />
                            {item.minutes}m
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
                          {item.detail}
                        </p>
                      </div>
                      <ArrowRight
                        className="mt-0.5 size-4 shrink-0 text-subtle-foreground transition-colors group-hover:text-primary"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
