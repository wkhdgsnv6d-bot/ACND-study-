import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlaskConical, FolderGit2, Lock, Wrench } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/common/card";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { ErrorState } from "@/components/common/states";
import { StatusPill } from "@/components/common/status-pill";
import {
  SKILLS,
  SKILL_KEYS,
  SKILL_LEVEL_DESCRIPTIONS,
  SKILL_LEVEL_NAMES,
  type SkillLevel,
} from "@/lib/domain/skills";
import { getProgressSnapshot } from "@/lib/queries/progress";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Skill Tree" };

const LEVELS: SkillLevel[] = [0, 1, 2, 3, 4, 5];

export default async function SkillsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const snapshot = await getProgressSnapshot(user);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Skill tree"
        description="A level is the lower of what you have studied and what you have proven. Reading every lesson in a branch caps it at Practised — no exceptions, and the reason is shown on each branch."
      />

      {snapshot.error ? (
        <ErrorState className="mt-6" description={snapshot.error} />
      ) : null}

      <Card className="mt-8">
        <CardHeader title="The levels" />
        <CardBody>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LEVELS.map((level) => (
              <li key={level} className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="font-mono text-subtle-foreground">{level}</span>{" "}
                  {SKILL_LEVEL_NAMES[level]}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
                  {SKILL_LEVEL_DESCRIPTIONS[level]}
                </p>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      <ul className="mt-8 space-y-3">
        {SKILL_KEYS.map((key) => {
          const skill = SKILLS[key];
          const state = snapshot.skills[key];
          const evidence = snapshot.evidence[key];
          const dependencies = skill.dependsOn.map((d) => SKILLS[d].name);

          return (
            <li key={key}>
              <Card>
                <CardBody className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: `var(${skill.colorToken})` }}
                        />
                        <h2 className="text-sm font-semibold tracking-tight">
                          {skill.name}
                        </h2>
                        <StatusPill tone={state.level >= 3 ? "success" : "neutral"}>
                          {SKILL_LEVEL_NAMES[state.level]}
                        </StatusPill>
                        <span className="font-mono text-xs text-subtle-foreground">
                          {state.xp} XP
                        </span>
                      </div>

                      <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
                        {skill.summary}
                      </p>

                      {dependencies.length > 0 ? (
                        <p className="mt-1.5 text-xs text-subtle-foreground">
                          Builds on {dependencies.join(" and ")}
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-subtle-foreground">
                        <span className="flex items-center gap-1.5">
                          <FlaskConical className="size-3" aria-hidden />
                          {evidence.labs} lab{evidence.labs === 1 ? "" : "s"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Wrench className="size-3" aria-hidden />
                          {evidence.practicals} practical
                          {evidence.practicals === 1 ? "" : "s"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <FolderGit2 className="size-3" aria-hidden />
                          {evidence.projects} project
                          {evidence.projects === 1 ? "" : "s"}
                        </span>
                      </div>

                      {state.capReason ? (
                        <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-muted px-3 py-2 text-xs text-muted-foreground">
                          <Lock className="mt-0.5 size-3 shrink-0 text-warning" aria-hidden />
                          <span className="min-w-0 text-pretty">{state.capReason}</span>
                        </p>
                      ) : null}
                    </div>

                    <div className="w-full shrink-0 sm:w-56">
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">Level {state.level}</span>
                        <span className="font-mono text-subtle-foreground">
                          {state.level}/5
                        </span>
                      </div>
                      <ProgressBar
                        label={`${skill.name} — level ${state.level} of 5`}
                        value={state.level / 5}
                        size="sm"
                        tone={state.level >= 3 ? "success" : "primary"}
                      />
                      <div className="mt-2 flex gap-1" aria-hidden>
                        {LEVELS.slice(1).map((level) => (
                          <span
                            key={level}
                            className="h-1 flex-1 rounded-full"
                            style={{
                              backgroundColor:
                                state.level >= level
                                  ? `var(${skill.colorToken})`
                                  : "var(--surface-3)",
                            }}
                          />
                        ))}
                      </div>
                      {state.nextLevel ? (
                        <p className="mt-2 text-xs text-subtle-foreground text-pretty">
                          {SKILL_LEVEL_NAMES[state.nextLevel.level]} needs{" "}
                          {state.nextLevel.xpNeeded > 0
                            ? `${state.nextLevel.xpNeeded} XP`
                            : null}
                          {state.nextLevel.xpNeeded > 0 &&
                          state.nextLevel.practicalsNeeded > 0
                            ? " and "
                            : null}
                          {state.nextLevel.practicalsNeeded > 0
                            ? `${state.nextLevel.practicalsNeeded} practical${state.nextLevel.practicalsNeeded === 1 ? "" : "s"}`
                            : null}
                          {state.nextLevel.xpNeeded === 0 &&
                          state.nextLevel.practicalsNeeded === 0
                            ? "a client-ready project and this branch's certification"
                            : null}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-success">Mastered</p>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
