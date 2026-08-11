import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/common/page-header";
import { StatusPill } from "@/components/common/status-pill";
import { LabRunner } from "@/components/labs/lab-runner";
import { LABS, LABS_BY_ID } from "@/lib/domain/labs";
import { SKILLS } from "@/lib/domain/skills";
import { getSolvedLabs } from "@/lib/queries/labs";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateStaticParams() {
  return LABS.map((lab) => ({ lab: lab.id }));
}

export async function generateMetadata(
  props: PageProps<"/labs/[lab]">,
): Promise<Metadata> {
  const { lab: id } = await props.params;
  return { title: LABS_BY_ID.get(id)?.title ?? "Lab" };
}

export default async function LabPage(props: PageProps<"/labs/[lab]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { lab: id } = await props.params;
  const lab = LABS_BY_ID.get(id);
  if (!lab) notFound();

  const { solved } = await getSolvedLabs(user);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link href="/labs" className="text-muted-foreground hover:text-foreground">
          Labs
        </Link>
        <span className="mx-2 text-subtle-foreground" aria-hidden>
          /
        </span>
        <span className="text-foreground">{lab.title}</span>
      </nav>

      <PageHeader
        title={lab.title}
        description={lab.summary}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="neutral">
              <span className="capitalize">{lab.difficulty}</span>
            </StatusPill>
            <StatusPill tone="neutral">~{lab.estimatedMinutes} min</StatusPill>
            <StatusPill tone="primary">+{lab.xp} XP</StatusPill>
            {lab.skills.map((key) => (
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

      <div className="mt-8">
        <LabRunner lab={lab} previouslySolved={solved.has(lab.id)} />
      </div>
    </div>
  );
}
