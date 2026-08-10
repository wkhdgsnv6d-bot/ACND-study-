import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Flame,
  Lock,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/common/card";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { EmptyState, ErrorState } from "@/components/common/states";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { loadCurriculum } from "@/lib/content/loader";
import { SKILLS, SKILL_KEYS } from "@/lib/domain/skills";
import { formatCurrency } from "@/lib/engines/finance";
import { SKILL_LEVEL_NAMES } from "@/lib/domain/skills";
import { getDashboardData } from "@/lib/queries/dashboard";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getDashboardData(user);
  const { curriculum } = loadCurriculum();

  const nextLesson = [...curriculum.lessonsByPath.values()].find(
    (lesson) => lesson.frontmatter.status === "complete",
  );

  const objectives = data.certifications
    .filter((c) => c.nextAction && c.status !== "certified")
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        eyebrow={<StatusPill tone="primary">Term 1 · Foundation</StatusPill>}
        title={`Welcome back${user.email ? `, ${user.email.split("@")[0]}` : ""}`}
        description="Everything below is computed from what you have actually done. A new account shows zeros — that is the point."
      />

      {data.error ? (
        <ErrorState
          className="mt-6"
          title="Could not load your data"
          description={
            <>
              {data.error} If this is a fresh Supabase project, run{" "}
              <code className="font-mono text-xs">npm run db:migrate</code> to create
              the tables and their row-level security policies.
            </>
          }
        />
      ) : null}

      {/* ---------------------------------------------------------------- */}
      <section
        aria-label="Key figures"
        className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        <StatCard
          label="Level"
          value={data.level.level}
          hint={`${data.xp.total.toLocaleString()} XP`}
          tone="primary"
        />
        <StatCard
          label="Streak"
          value={
            <span className="flex items-center gap-1.5">
              {data.streak.current}
              {data.streak.current > 0 ? (
                <Flame className="size-4 text-warning" aria-hidden />
              ) : null}
            </span>
          }
          hint={data.streak.current === 0 ? "Not started" : `Best ${data.streak.longest}`}
        />
        <StatCard
          label="Lessons"
          value={`${data.lessonsCompleted}/${data.lessonsAvailable}`}
          hint="Published lessons"
        />
        <StatCard
          label="Certifications"
          value={data.certifications.filter((c) => c.status === "certified").length}
          hint={`of ${data.certifications.length}`}
        />
        <StatCard
          label="Revenue"
          value={formatCurrency(data.metrics.totalRevenue * 100)}
          hint="All time"
          tone={data.metrics.totalRevenue > 0 ? "success" : "muted"}
        />
        <StatCard
          label="MRR"
          value={formatCurrency(data.metrics.mrr * 100)}
          hint={`${data.metrics.activeClients} active`}
          tone={data.metrics.mrr > 0 ? "success" : "muted"}
        />
      </section>

      {/* ---------------------------------------------------------------- */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Continue learning */}
          <Card elevated>
            <CardBody className="py-5">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="size-3.5 shrink-0" aria-hidden />
                    Continue learning
                  </div>
                  {nextLesson ? (
                    <>
                      <h2 className="mt-2 text-lg font-semibold tracking-tight text-balance">
                        {nextLesson.frontmatter.title}
                      </h2>
                      <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
                        {nextLesson.frontmatter.summary}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-subtle-foreground">
                        <span>{nextLesson.frontmatter.duration} min</span>
                        <span aria-hidden>·</span>
                        <span className="capitalize">
                          {nextLesson.frontmatter.difficulty}
                        </span>
                        <span aria-hidden>·</span>
                        <span>
                          {curriculum.modulesByPath.get(
                            `${nextLesson.termSlug}/${nextLesson.moduleSlug}`,
                          )?.frontmatter.title}
                        </span>
                      </div>
                      <Button className="mt-5" disabled>
                        Open lesson
                        <ArrowRight />
                      </Button>
                      <p className="mt-2 text-xs text-subtle-foreground">
                        The lesson reader arrives in Phase 3.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="mt-2 text-lg font-semibold tracking-tight">
                        No published lessons yet
                      </h2>
                      <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
                        The curriculum is written module by module in Phase 8. Lessons
                        still marked draft are excluded here on purpose — the platform
                        will not present a stub as something to study.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Current objectives */}
          <Card>
            <CardHeader
              title="Current objectives"
              description="The next unmet requirement on each certification you are closest to."
            />
            <CardBody>
              {objectives.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="Nothing in flight yet"
                  description="Objectives appear once you begin a module. They are always the single next thing standing between you and a certification."
                />
              ) : (
                <ul className="space-y-4">
                  {objectives.map((cert) => (
                    <li key={cert.key}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium">
                          {cert.definition.name}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                          {Math.round(cert.progress * 100)}%
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
                        {cert.nextAction}
                      </p>
                      <ProgressBar
                        className="mt-2"
                        size="sm"
                        label={`${cert.definition.name} progress`}
                        value={cert.progress}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader title="Recent activity" />
            <CardBody>
              <EmptyState
                icon={TrendingUp}
                title="No activity yet"
                description="Completed lessons, solved labs, submitted work and business milestones appear here as they happen."
              />
            </CardBody>
          </Card>
        </div>

        {/* -------------------------------------------------------------- */}
        <div className="min-w-0 space-y-6">
          {/* Skills */}
          <Card>
            <CardHeader
              title="Skill progress"
              description="Level is the lower of what you have studied and what you have proven."
            />
            <CardBody className="space-y-3">
              {SKILL_KEYS.map((key) => {
                const skill = SKILLS[key];
                const state = data.skills[key];
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: `var(${skill.colorToken})` }}
                        />
                        <span className="min-w-0 truncate text-xs">{skill.name}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-subtle-foreground">
                        {SKILL_LEVEL_NAMES[state.level]}
                      </span>
                    </div>
                    <ProgressBar
                      size="sm"
                      label={`${skill.name} — level ${state.level} of 5`}
                      value={state.level / 5}
                      tone={state.level >= 3 ? "success" : "primary"}
                    />
                  </div>
                );
              })}
            </CardBody>
          </Card>

          {/* Term 4 */}
          <Card>
            <CardHeader
              title="Term 4"
              description={
                data.term4.unlocked
                  ? "Unlocked."
                  : "Locked until the business says otherwise."
              }
            />
            <CardBody>
              <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="min-w-0 italic text-pretty">{data.term4.message}</span>
              </p>
              {data.term4.nearest ? (
                <div className="mt-4">
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">
                      Closest: {data.term4.nearest.label}
                    </span>
                    <span className="shrink-0 font-mono text-subtle-foreground tabular-nums">
                      {Math.round(data.term4.nearest.progress * 100)}%
                    </span>
                  </div>
                  <ProgressBar
                    size="sm"
                    label="Progress toward the nearest Term 4 threshold"
                    value={data.term4.nearest.progress}
                    tone="muted"
                  />
                </div>
              ) : null}
              <Link
                href="/settings#unlocks"
                className="mt-4 inline-block text-xs text-primary hover:underline"
              >
                Adjust thresholds
              </Link>
            </CardBody>
          </Card>

          {/* Outreach funnel */}
          <Card>
            <CardHeader
              title="Outreach"
              description="The numbers that decide whether Ascend has a business."
            />
            <CardBody>
              <dl className="space-y-2.5 text-sm">
                <Row label="Prospects contacted" value={data.prospectsContacted} />
                <Row label="Clients" value={data.clientsWon} />
                <Row label="Projects built" value={data.projectCount} />
                <Row label="Labs solved" value={data.labsSolved} />
                <Row label="Work approved" value={data.submissionsApproved} />
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 truncate text-muted-foreground">{label}</dt>
      <dd className="shrink-0 font-mono tabular-nums">{value}</dd>
    </div>
  );
}
