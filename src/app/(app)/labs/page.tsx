import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Circle, FlaskConical } from "lucide-react";

import { Card, CardBody } from "@/components/common/card";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/states";
import { StatusPill } from "@/components/common/status-pill";
import { LABS } from "@/lib/domain/labs";
import { SKILLS } from "@/lib/domain/skills";
import { labItemCount } from "@/lib/engines/labs";
import { getSolvedLabs } from "@/lib/queries/labs";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Labs" };

export default async function LabsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { solved, error } = await getSolvedLabs(user);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Practical labs"
        description="Situations rather than questions. Each one reproduces a moment where the knowledge normally fails, so the mistake happens here instead of on a client's system."
      />

      {error ? <ErrorState className="mt-6" description={error} /> : null}

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Solved"
          value={`${solved.size}/${LABS.length}`}
          tone={solved.size > 0 ? "success" : "muted"}
        />
        <StatCard
          label="XP available"
          value={LABS.filter((l) => !solved.has(l.id))
            .reduce((sum, l) => sum + l.xp, 0)
            .toLocaleString()}
          hint="From unsolved labs"
        />
        <StatCard
          label="Time"
          value={`${LABS.filter((l) => !solved.has(l.id)).reduce((s, l) => s + l.estimatedMinutes, 0)} min`}
          hint="Remaining, estimated"
        />
      </section>

      {LABS.length === 0 ? (
        <EmptyState className="mt-8" icon={FlaskConical} title="No labs yet" />
      ) : (
        <ul className="mt-8 space-y-3">
          {LABS.map((lab) => {
            const done = solved.has(lab.id);
            return (
              <li key={lab.id}>
                <Card>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-semibold tracking-tight">
                            {lab.title}
                          </h2>
                          {done ? (
                            <StatusPill tone="success">Solved</StatusPill>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground text-pretty">
                          {lab.summary}
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-subtle-foreground">
                          <span className="capitalize">{lab.difficulty}</span>
                          <span>~{lab.estimatedMinutes} min</span>
                          <span>{labItemCount(lab)} items</span>
                          <span>+{lab.xp} XP</span>
                          <span className="flex items-center gap-1.5">
                            {lab.skills.map((key) => (
                              <span
                                key={key}
                                title={SKILLS[key].name}
                                role="img"
                                aria-label={SKILLS[key].name}
                                className="size-1.5 rounded-full"
                                style={{ backgroundColor: `var(${SKILLS[key].colorToken})` }}
                              />
                            ))}
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/labs/${lab.id}`}
                        className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary"
                        aria-label={`Open ${lab.title}`}
                      >
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
