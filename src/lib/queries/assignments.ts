import type { User } from "@supabase/supabase-js";

import { loadCurriculum } from "@/lib/content/loader";
import type { PracticalTask } from "@/lib/content/schema";
import type { SkillKey } from "@/lib/domain/skills";
import { createClient } from "@/lib/supabase/server";

/**
 * Every piece of evidence-bearing work in the curriculum, with its status.
 *
 * Practical tasks are declared in lesson frontmatter rather than in the
 * database, so this walks the content and joins whatever submissions exist.
 * A task nobody has started simply has no row.
 */

export type SubmissionStatus =
  | "not-started"
  | "draft"
  | "submitted"
  | "approved"
  | "needs_improvement";

export interface AssignmentItem {
  /** Lesson path — the submission ref. */
  ref: string;
  task: PracticalTask;
  lessonTitle: string;
  moduleTitle: string;
  termNumber: 1 | 2 | 3 | 4;
  href: string;
  skills: SkillKey[];
  status: SubmissionStatus;
  submittedAt: Date | null;
  /** True when the lesson itself is still a draft, so the task is not yet real. */
  lessonDraft: boolean;
}

export interface AssignmentsOverview {
  items: AssignmentItem[];
  approvedCount: number;
  totalXpAvailable: number;
  totalXpEarned: number;
  error: string | null;
}

export async function getAssignments(user: User): Promise<AssignmentsOverview> {
  const { curriculum } = loadCurriculum();

  const items: Omit<AssignmentItem, "status" | "submittedAt">[] = [];
  for (const lesson of curriculum.lessonsByPath.values()) {
    const task = lesson.frontmatter.practicalTask;
    if (!task) continue;
    const mod = curriculum.modulesByPath.get(
      `${lesson.termSlug}/${lesson.moduleSlug}`,
    );
    items.push({
      ref: lesson.path,
      task,
      lessonTitle: lesson.frontmatter.title,
      moduleTitle: mod?.frontmatter.title ?? lesson.moduleSlug,
      termNumber: lesson.termNumber,
      href: `/course/${lesson.termSlug}/${lesson.moduleSlug}/${lesson.slug}#practical-task`,
      skills: Object.keys(
        task.skillXp ?? lesson.frontmatter.skillXp,
      ) as SkillKey[],
      lessonDraft: lesson.frontmatter.status === "draft",
    });
  }

  const supabase = await createClient();
  if (!supabase) {
    return {
      items: items.map((item) => ({
        ...item,
        status: "not-started" as const,
        submittedAt: null,
      })),
      approvedCount: 0,
      totalXpAvailable: items.reduce((sum, i) => sum + i.task.xp, 0),
      totalXpEarned: 0,
      error: "Database not configured.",
    };
  }

  const { data, error } = await supabase
    .from("submissions")
    .select("ref, status, submitted_at")
    .eq("user_id", user.id)
    .eq("kind", "practical");

  const byRef = new Map(
    (data ?? []).map((row) => {
      const r = row as {
        ref: string;
        status: Exclude<SubmissionStatus, "not-started">;
        submitted_at: string | null;
      };
      return [r.ref, r] as const;
    }),
  );

  const resolved: AssignmentItem[] = items.map((item) => {
    const row = byRef.get(item.ref);
    return {
      ...item,
      status: row?.status ?? "not-started",
      submittedAt: row?.submitted_at ? new Date(row.submitted_at) : null,
    };
  });

  const approved = resolved.filter((i) => i.status === "approved");

  return {
    items: resolved,
    approvedCount: approved.length,
    totalXpAvailable: resolved
      .filter((i) => !i.lessonDraft)
      .reduce((sum, i) => sum + i.task.xp, 0),
    totalXpEarned: approved.reduce((sum, i) => sum + i.task.xp, 0),
    error: error?.message ?? null,
  };
}
