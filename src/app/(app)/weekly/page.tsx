import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Activity } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/common/card";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/states";
import { SKILLS } from "@/lib/domain/skills";
import { formatCurrency } from "@/lib/engines/finance";
import { studyHistogram } from "@/lib/engines/streak";
import { getProgressSnapshot } from "@/lib/queries/progress";
import { getSettings } from "@/lib/queries/settings";
import { getWeeklySummary } from "@/lib/queries/study";
import { weakestSkills } from "@/lib/engines/skills";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Weekly Review" };

export default async function WeeklyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [summary, snapshot, settings] = await Promise.all([
    getWeeklySummary(user),
    getProgressSnapshot(user),
    getSettings(user),
  ]);

  const histogram = studyHistogram(snapshot.studyDays, summary.to, 7);
  const peak = Math.max(1, ...histogram.map((d) => d.minutes));
  const weak = weakestSkills(snapshot.skills, { limit: 3 });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Weekly review"
        description={`${summary.from} to ${summary.to}. What actually happened, rather than what it felt like.`}
      />

      {summary.error ? (
        <ErrorState className="mt-6" description={summary.error} />
      ) : null}

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Studied"
          value={`${Math.floor(summary.minutes / 60)}h ${summary.minutes % 60}m`}
        />
        <StatCard label="Lessons" value={summary.lessonsCompleted} />
        <StatCard label="Labs" value={summary.labsSolved} />
        <StatCard
          label="Quiz average"
          value={summary.averageQuizScore === null ? "—" : `${summary.averageQuizScore}%`}
          hint={`${summary.quizAttempts} attempts`}
        />
        <StatCard label="Work submitted" value={summary.submissions} />
        <StatCard
          label="MRR"
          value={formatCurrency(snapshot.metrics.mrr * 100, {
            currency: settings.currency,
          })}
          tone={snapshot.metrics.mrr > 0 ? "success" : "muted"}
        />
      </section>

      <Card className="mt-8">
        <CardHeader title="Study time" description="Minutes per day this week." />
        <CardBody>
          <div className="flex h-32 items-end gap-2">
            {histogram.map((day) => (
              <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-t bg-primary transition-all"
                  style={{ height: `${Math.max(2, (day.minutes / peak) * 100)}%` }}
                  title={`${day.minutes} minutes`}
                />
                <span className="truncate text-[10px] text-subtle-foreground">
                  {new Date(`${day.day}T00:00:00`).toLocaleDateString("en-AU", {
                    weekday: "narrow",
                  })}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-subtle-foreground">
            Peak {peak} minutes · target {settings.dailyStudyTargetMinutes} per day
          </p>
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Weakest branches"
            description="Where next week's effort would go furthest."
          />
          <CardBody>
            {weak.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No branches started yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {weak.map((skill) => (
                  <li key={skill.key}>
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full"
                        style={{
                          backgroundColor: `var(${SKILLS[skill.key].colorToken})`,
                        }}
                      />
                      <span className="text-sm font-medium">
                        {SKILLS[skill.key].name}
                      </span>
                      <span className="ml-auto font-mono text-xs text-subtle-foreground">
                        {skill.levelName}
                      </span>
                    </div>
                    {skill.capReason ? (
                      <p className="mt-1 text-xs text-muted-foreground text-pretty">
                        {skill.capReason}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="What happened" />
          <CardBody>
            {summary.activities.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="A quiet week"
                description="Nothing recorded. That is information too."
              />
            ) : (
              <ul className="space-y-2">
                {summary.activities.slice(0, 12).map((item, index) => (
                  <li key={index} className="flex items-baseline gap-2 text-sm">
                    <time
                      dateTime={item.occurredAt}
                      className="shrink-0 font-mono text-xs text-subtle-foreground"
                    >
                      {new Date(item.occurredAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </time>
                    <span className="min-w-0 text-muted-foreground text-pretty">
                      {item.summary}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
