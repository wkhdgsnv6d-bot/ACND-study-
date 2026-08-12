import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Code2, ExternalLink, FolderGit2 } from "lucide-react";

import {
  DeleteProjectButton,
  NewProjectPanel,
  ProjectForm,
  type ProjectRow,
} from "@/app/(app)/projects/project-form";
import { Card, CardBody } from "@/components/common/card";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/states";
import { StatusPill } from "@/components/common/status-pill";
import { SKILLS, type SkillKey } from "@/lib/domain/skills";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data, error } = supabase
    ? await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
    : { data: [], error: null };

  const projects: ProjectRow[] = (data ?? []).map((row) => {
    const r = row as Record<string, never> & {
      id: string;
      name: string;
      description: string | null;
      status: ProjectRow["status"];
      skills: string[] | null;
      tech: string[] | null;
      repo_url: string | null;
      live_url: string | null;
      screenshots: string[] | null;
      lessons_learned: string | null;
      problems_encountered: string | null;
      how_i_solved_them: string | null;
      client_ready: boolean;
      portfolio_ready: boolean;
    };
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      skills: (r.skills ?? []) as SkillKey[],
      tech: r.tech ?? [],
      repoUrl: r.repo_url,
      liveUrl: r.live_url,
      screenshots: r.screenshots ?? [],
      lessonsLearned: r.lessons_learned,
      problemsEncountered: r.problems_encountered,
      howISolvedThem: r.how_i_solved_them,
      clientReady: r.client_ready,
      portfolioReady: r.portfolio_ready,
    };
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Projects"
        description="What you have actually built. A project is the strongest evidence the platform accepts, and the only kind that can lift a skill to Mastered."
      />

      {error ? <ErrorState className="mt-6" description={error.message} /> : null}

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Projects" value={projects.length} />
        <StatCard
          label="Client ready"
          value={projects.filter((p) => p.clientReady).length}
          tone={projects.some((p) => p.clientReady) ? "success" : "muted"}
        />
        <StatCard
          label="Portfolio ready"
          value={projects.filter((p) => p.portfolioReady).length}
        />
      </section>

      <div className="mt-8">
        <NewProjectPanel />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={FolderGit2}
          title="No projects yet"
          description="Add the first thing you build. Record what went wrong as well as what you shipped — that is the part that makes it evidence."
        />
      ) : (
        <ul className="mt-6 space-y-4">
          {projects.map((project) => (
            <li key={project.id}>
              <Card>
                <CardBody className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold tracking-tight">
                          {project.name}
                        </h2>
                        {project.clientReady ? (
                          <StatusPill tone="success">Client ready</StatusPill>
                        ) : null}
                        {project.portfolioReady ? (
                          <StatusPill tone="info">Portfolio</StatusPill>
                        ) : null}
                        <StatusPill tone="neutral">
                          {project.status.replace("_", " ")}
                        </StatusPill>
                      </div>

                      {project.description ? (
                        <p className="mt-1 text-sm text-muted-foreground text-pretty">
                          {project.description}
                        </p>
                      ) : null}

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                        {project.repoUrl ? (
                          <a
                            href={project.repoUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="flex items-center gap-1.5 text-primary hover:underline"
                          >
                            <Code2 className="size-3" aria-hidden />
                            Repository
                          </a>
                        ) : null}
                        {project.liveUrl ? (
                          <a
                            href={project.liveUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="flex items-center gap-1.5 text-primary hover:underline"
                          >
                            <ExternalLink className="size-3" aria-hidden />
                            Live
                          </a>
                        ) : null}
                        {project.tech.length > 0 ? (
                          <span className="text-subtle-foreground">
                            {project.tech.join(" · ")}
                          </span>
                        ) : null}
                        <span className="flex items-center gap-1.5">
                          {project.skills.map((key) =>
                            SKILLS[key] ? (
                              <span
                                key={key}
                                title={SKILLS[key].name}
                                role="img"
                                aria-label={SKILLS[key].name}
                                className="size-1.5 rounded-full"
                                style={{
                                  backgroundColor: `var(${SKILLS[key].colorToken})`,
                                }}
                              />
                            ) : null,
                          )}
                        </span>
                      </div>

                      {project.lessonsLearned ? (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs text-primary hover:underline">
                            What I learned
                          </summary>
                          <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                            {project.lessonsLearned}
                          </p>
                          {project.problemsEncountered ? (
                            <p className="mt-3 text-sm whitespace-pre-wrap text-muted-foreground">
                              <strong className="text-foreground">
                                Problems:
                              </strong>{" "}
                              {project.problemsEncountered}
                            </p>
                          ) : null}
                          {project.howISolvedThem ? (
                            <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                              <strong className="text-foreground">Solved by:</strong>{" "}
                              {project.howISolvedThem}
                            </p>
                          ) : null}
                        </details>
                      ) : null}
                    </div>

                    <DeleteProjectButton id={project.id} />
                  </div>

                  <details className="mt-4 border-t border-border pt-3">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      Edit
                    </summary>
                    <div className="mt-4">
                      <ProjectForm project={project} />
                    </div>
                  </details>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
