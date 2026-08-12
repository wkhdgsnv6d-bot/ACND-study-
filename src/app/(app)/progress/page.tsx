import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/common/card";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { loadCurriculum } from "@/lib/content/loader";
import { SKILLS, SKILL_KEYS, SKILL_LEVEL_NAMES } from "@/lib/domain/skills";
import { formatCurrency } from "@/lib/engines/finance";
import { studyHistogram } from "@/lib/engines/streak";
import { PRACTICAL_XP_SOURCES } from "@/lib/engines/xp";
import { getProgressSnapshot } from "@/lib/queries/progress";
import { getSettings } from "@/lib/queries/settings";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [snapshot, settings] = await Promise.all([
    getProgressSnapshot(user),
    getSettings(user),
  ]);

  const { curriculum } = loadCurriculum();
  const today = new Date().toISOString().slice(0, 10);
  const histogram = studyHistogram(snapshot.studyDays, today, 30);
  const peak = Math.max(1, ...histogram.map((d) => d.minutes));
  const totalMinutes = snapshot.studyDays.reduce((sum, d) => sum + d.minutes, 0);

  const bySource = Object.entries(snapshot.xp.bySource)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxSource = Math.max(1, ...bySource.map(([, amount]) => amount));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Progress"
        description="The detailed version. The dashboard shows what to do next; this shows what has happened."
        action={
          <Button asChild variant="secondary" size="sm">
            <a href="/api/export" download>
              <Download />
              Export data
            </a>
          </Button>
        }
      />

      {snapshot.error ? (
        <ErrorState className="mt-6" description={snapshot.error} />
      ) : null}

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Level"
          value={snapshot.level.level}
          hint={`${snapshot.xp.total.toLocaleString()} XP`}
          tone="primary"
        />
        <StatCard
          label="Study time"
          value={`${Math.floor(totalMinutes / 60)}h`}
          hint="All time"
        />
        <StatCard
          label="Lessons"
          value={`${snapshot.completedLessons.size}/${snapshot.lessonsAvailable}`}
        />
        <StatCard label="Labs" value={snapshot.solvedLabs.size} />
        <StatCard
          label="Certifications"
          value={snapshot.earnedCertifications.size}
          hint={`of ${snapshot.certifications.length}`}
        />
        <StatCard
          label="MRR"
          value={formatCurrency(snapshot.metrics.mrr * 100, {
            currency: settings.currency,
          })}
          tone={snapshot.metrics.mrr > 0 ? "success" : "muted"}
        />
      </section>

      <Card className="mt-8">
        <CardHeader
          title="Study time"
          description="Minutes per day over the last 30 days."
        />
        <CardBody>
          <div className="flex h-32 items-end gap-0.5">
            {histogram.map((day) => (
              <div
                key={day.day}
                className="min-w-0 flex-1 rounded-t bg-primary/80"
                style={{ height: `${Math.max(2, (day.minutes / peak) * 100)}%` }}
                title={`${day.day}: ${day.minutes} minutes`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-subtle-foreground">
            <span>{histogram[0]?.day}</span>
            <span>peak {peak}m</span>
            <span>{today}</span>
          </div>
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Where XP came from"
            description="Reading should be the smallest slice. If it is not, the balance is wrong."
          />
          <CardBody>
            {bySource.length === 0 ? (
              <p className="text-sm text-muted-foreground">No XP yet.</p>
            ) : (
              <>
                <ul className="space-y-2.5">
                  {bySource.map(([source, amount]) => (
                    <li key={source}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-muted-foreground capitalize">
                          {source.replaceAll("-", " ")}
                        </span>
                        <span className="font-mono text-subtle-foreground tabular-nums">
                          {amount.toLocaleString()}
                        </span>
                      </div>
                      <ProgressBar
                        label={`${source} XP`}
                        value={amount / maxSource}
                        size="sm"
                        tone={
                          PRACTICAL_XP_SOURCES.includes(
                            source as (typeof PRACTICAL_XP_SOURCES)[number],
                          )
                            ? "success"
                            : "muted"
                        }
                      />
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                  {Math.round(snapshot.xp.practicalRatio * 100)}% of your XP came from
                  producing something rather than consuming a lesson.
                </p>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Skill levels" />
          <CardBody className="space-y-2.5">
            {SKILL_KEYS.map((key) => {
              const state = snapshot.skills[key];
              return (
                <div key={key}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: `var(${SKILLS[key].colorToken})` }}
                      />
                      <span className="truncate text-muted-foreground">
                        {SKILLS[key].name}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-subtle-foreground">
                      {SKILL_LEVEL_NAMES[state.level]}
                    </span>
                  </div>
                  <ProgressBar
                    label={`${SKILLS[key].name} level`}
                    value={state.level / 5}
                    size="sm"
                    tone={state.level >= 3 ? "success" : "primary"}
                  />
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Curriculum coverage"
          description="Published lessons only. Draft content is excluded from every denominator."
        />
        <CardBody className="space-y-4">
          {curriculum.terms.map((term) => {
            const lessons = term.modules.flatMap((m) => m.lessons);
            const published = lessons.filter(
              (l) => l.frontmatter.status === "complete",
            );
            const done = published.filter((l) =>
              snapshot.completedLessons.has(l.path),
            ).length;

            return (
              <div key={term.path}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {term.frontmatter.title}
                  </span>
                  <span className="shrink-0 font-mono text-subtle-foreground tabular-nums">
                    {done}/{published.length} of {lessons.length} written
                  </span>
                </div>
                <ProgressBar
                  label={`${term.frontmatter.title} progress`}
                  value={published.length === 0 ? 0 : done / published.length}
                  size="sm"
                />
              </div>
            );
          })}
        </CardBody>
      </Card>
    </div>
  );
}
