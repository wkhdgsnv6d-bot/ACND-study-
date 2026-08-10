import {
  BookOpen,
  CheckCircle2,
  CircleDashed,
  FlaskConical,
  Lock,
  ShieldCheck,
} from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/common/card";
import { ProgressBar } from "@/components/common/progress-bar";
import { StatusPill } from "@/components/common/status-pill";
import { loadCurriculum } from "@/lib/content/loader";
import { CERTIFICATIONS } from "@/lib/domain/certifications";
import { SKILLS, SKILL_KEYS } from "@/lib/domain/skills";
import { DEFAULT_TERM_4_CONFIG, evaluateTerm4Unlock } from "@/lib/engines/unlock";

/**
 * Foundation status page.
 *
 * Phase 1 delivers the design system, the content pipeline and the scoring
 * engines — not yet the dashboard, which needs authentication and a database
 * (Phase 2). Rather than a placeholder, this page reports the real state of
 * those foundations by reading the curriculum through the same loader the
 * lesson routes will use. If content is broken, this page shows it.
 */
export default function FoundationPage() {
  const { curriculum, issues } = loadCurriculum();

  const modules = curriculum.terms.flatMap((t) => t.modules);
  const lessons = [...curriculum.lessonsByPath.values()];
  const complete = lessons.filter((l) => l.frontmatter.status === "complete");
  const words = lessons.reduce((sum, l) => sum + l.wordCount, 0);

  const term4 = evaluateTerm4Unlock(DEFAULT_TERM_4_CONFIG, {
    monthlyRevenue: 0,
    mrr: 0,
    activeClients: 0,
    totalRevenue: 0,
    contractors: 0,
  });

  const errors = issues.filter((i) => i.severity === "error");

  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      <header>
        <StatusPill tone="primary">Phase 1 · Foundation</StatusPill>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Ascend Business Mastery
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground text-pretty">
          The private operating school for building Ascend — from beginner to
          technically client-ready, to agency operator, to founder who can run
          the company rather than only do the work.
        </p>
      </header>

      <section className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Foundation summary">
        <Stat label="Modules scaffolded" value={String(modules.length)} />
        <Stat
          label="Lessons written"
          value={`${complete.length} / ${lessons.length}`}
          hint={`${words.toLocaleString()} words`}
        />
        <Stat label="Certifications defined" value={String(CERTIFICATIONS.length)} />
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="self-start">
          <CardHeader
            title="Foundations built"
            description="What Phase 1 delivered, verified by the test suite."
          />
          <CardBody className="space-y-3">
            <Built label="Dark-first design tokens and theming" />
            <Built label="MDX content pipeline with schema validation" />
            <Built label="XP ledger and learner levelling" />
            <Built label="Skill engine — evidence-gated levels 0–5" />
            <Built label="Certification engine — declarative requirements" />
            <Built label="Term 4 business-trigger unlocking" />
            <Built label="Study streaks with timezone-correct day handling" />
            <Built label="Spaced repetition (SM-2, mistake-driven)" />
            <Built label="Agency finance — margins, LTV, capacity, hiring" />
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Content pipeline"
              description="Every MDX file is validated at build time. Broken content fails the build."
            />
            <CardBody>
              {errors.length === 0 ? (
                <p className="flex items-start gap-2 text-sm text-success">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    Curriculum valid — {lessons.length} lesson
                    {lessons.length === 1 ? "" : "s"} parsed, no errors.
                  </span>
                </p>
              ) : (
                <p className="flex items-start gap-2 text-sm text-destructive">
                  <CircleDashed className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    {errors.length} content error{errors.length === 1 ? "" : "s"}{" "}
                    — run <code className="font-mono">npm run content:check</code>
                    .
                  </span>
                </p>
              )}

              <div className="mt-5 space-y-4">
                {curriculum.terms.map((term) => {
                  const termLessons = term.modules.flatMap((m) => m.lessons);
                  const done = termLessons.filter(
                    (l) => l.frontmatter.status === "complete",
                  ).length;
                  return (
                    <div key={term.path}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        {/* `min-w-0` is what lets `truncate` actually truncate:
                            without it the nowrap text sets the flex item's
                            min-content width and pushes the page sideways. */}
                        <span className="min-w-0 truncate text-sm font-medium">
                          {term.frontmatter.title}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                          {done}/{termLessons.length}
                        </span>
                      </div>
                      <ProgressBar
                        label={`${term.frontmatter.title} content coverage`}
                        value={termLessons.length === 0 ? 0 : done / termLessons.length}
                        size="sm"
                        tone={done === termLessons.length && done > 0 ? "success" : "primary"}
                      />
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Term 4"
              description="Locked until Ascend produces evidence the material applies."
            />
            <CardBody>
              <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="min-w-0 italic">{term4.message}</span>
              </p>
              <ul className="mt-4 space-y-2.5">
                {term4.thresholds.map((threshold) => (
                  <li key={threshold.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{threshold.label}</span>
                      <span className="font-mono text-subtle-foreground tabular-nums">
                        {formatThreshold(threshold.current, threshold.format)} /{" "}
                        {formatThreshold(threshold.target, threshold.format)}
                      </span>
                    </div>
                    <ProgressBar
                      label={`${threshold.label} toward Term 4 unlock`}
                      value={threshold.progress}
                      size="sm"
                      tone={threshold.met ? "success" : "muted"}
                    />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </section>

      <section className="mt-12">
        <Card>
          <CardHeader
            title="Skill branches"
            description="Levels are the minimum of what you have studied and what you have proven — reading alone caps a branch at Practised."
          />
          <CardBody>
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {SKILL_KEYS.map((key) => {
                const skill = SKILLS[key];
                return (
                  <li key={key} className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(${skill.colorToken})` }}
                    />
                    <span className="truncate text-sm">{skill.name}</span>
                    <span className="ml-auto shrink-0 font-mono text-xs text-subtle-foreground">
                      T{skill.introducedInTerm}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold tracking-tight">Next</h2>
        <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
          <Next icon={BookOpen}>
            Phase 2 — database schema, row-level security, authentication,
            application shell and dashboard.
          </Next>
          <Next icon={FlaskConical}>
            Phase 3 — the lesson experience, progress tracking, notes,
            assignments, quizzes and exams.
          </Next>
        </ul>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      {hint ? (
        <div className="mt-0.5 font-mono text-xs text-subtle-foreground">{hint}</div>
      ) : null}
    </Card>
  );
}

function Built({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
      <span className="min-w-0 text-muted-foreground">{label}</span>
    </div>
  );
}

function Next({
  icon: Icon,
  children,
}: {
  icon: typeof BookOpen;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-subtle-foreground" aria-hidden />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function formatThreshold(value: number, format: "currency" | "count"): string {
  if (format === "currency") {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return String(value);
}
