import type { User } from "@supabase/supabase-js";

import { loadCurriculum } from "@/lib/content/loader";
import type { LessonNode, ModuleNode, TermNode } from "@/lib/content/types";
import { evaluateLessonLock, type LockState } from "@/lib/engines/unlock";
import { createClient } from "@/lib/supabase/server";

/**
 * Course progress.
 *
 * Progress rows reference lessons by their content path, so the curriculum can
 * be edited in a pull request without a migration. Draft lessons are excluded
 * from every denominator here for the same reason they are excluded from
 * certifications: unwritten content must never make progress look worse, or a
 * module look incomplete, than it really is.
 */

export type LessonStatus = "not_started" | "in_progress" | "completed";

export interface LessonProgressRow {
  lessonPath: string;
  status: LessonStatus;
  secondsSpent: number;
  scrollCompletion: number;
  completedAt: Date | null;
}

export interface ModuleProgress {
  module: ModuleNode;
  /** Lessons with `status: complete` — the ones that count. */
  gradableCount: number;
  completedCount: number;
  /** 0–1 across gradable lessons. */
  fraction: number;
  /** Total estimated minutes of unfinished gradable lessons. */
  remainingMinutes: number;
  lock: LockState;
}

export interface TermProgress {
  term: TermNode;
  modules: ModuleProgress[];
  gradableCount: number;
  completedCount: number;
  fraction: number;
}

export interface CourseOverview {
  terms: TermProgress[];
  completedLessons: Set<string>;
  error: string | null;
}

async function fetchProgress(
  user: User,
): Promise<{ rows: LessonProgressRow[]; error: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { rows: [], error: "Database not configured." };

  const { data, error } = await supabase
    .from("lesson_progress")
    .select("lesson_path, status, seconds_spent, scroll_completion, completed_at")
    .eq("user_id", user.id);

  if (error) return { rows: [], error: error.message };

  const rows = (data ?? []).map((row) => {
    const r = row as {
      lesson_path: string;
      status: LessonStatus;
      seconds_spent: number;
      scroll_completion: number;
      completed_at: string | null;
    };
    return {
      lessonPath: r.lesson_path,
      status: r.status,
      secondsSpent: r.seconds_spent,
      scrollCompletion: r.scroll_completion,
      completedAt: r.completed_at ? new Date(r.completed_at) : null,
    };
  });

  return { rows, error: null };
}

export async function getCourseOverview(user: User): Promise<CourseOverview> {
  const { curriculum } = loadCurriculum();
  const { rows, error } = await fetchProgress(user);

  const completedLessons = new Set(
    rows.filter((r) => r.status === "completed").map((r) => r.lessonPath),
  );

  const terms = curriculum.terms.map((term) =>
    buildTermProgress(term, completedLessons),
  );

  return { terms, completedLessons, error };
}

export function buildTermProgress(
  term: TermNode,
  completedLessons: ReadonlySet<string>,
): TermProgress {
  const modules = term.modules.map((mod) =>
    buildModuleProgress(mod, completedLessons),
  );

  const gradableCount = modules.reduce((sum, m) => sum + m.gradableCount, 0);
  const completedCount = modules.reduce((sum, m) => sum + m.completedCount, 0);

  return {
    term,
    modules,
    gradableCount,
    completedCount,
    fraction: gradableCount === 0 ? 0 : completedCount / gradableCount,
  };
}

export function buildModuleProgress(
  mod: ModuleNode,
  completedLessons: ReadonlySet<string>,
): ModuleProgress {
  const gradable = mod.lessons.filter((l) => l.frontmatter.status === "complete");
  const completed = gradable.filter((l) => completedLessons.has(l.path));
  const remaining = gradable.filter((l) => !completedLessons.has(l.path));

  return {
    module: mod,
    gradableCount: gradable.length,
    completedCount: completed.length,
    fraction: gradable.length === 0 ? 0 : completed.length / gradable.length,
    remainingMinutes: remaining.reduce((sum, l) => sum + l.frontmatter.duration, 0),
    lock: { locked: false, blockedBy: [], reason: null },
  };
}

/* ------------------------------------------------------------------ */
/* A single lesson                                                     */
/* ------------------------------------------------------------------ */

export interface LessonNoteRow {
  id: string;
  title: string | null;
  bodyMd: string;
  pinned: boolean;
  updatedAt: Date;
}

export interface QuizAttemptSummary {
  attemptNumber: number;
  scorePercent: number;
  passed: boolean;
  attemptedAt: Date;
}

export interface PracticalSubmissionRow {
  status: "draft" | "submitted" | "approved" | "needs_improvement";
  rubricCheck: Record<string, boolean>;
  evidence: {
    repoUrl?: string;
    liveUrl?: string;
    externalUrl?: string;
    screenshots?: string[];
    writeUp?: string;
  };
}

export interface LessonPageData {
  progress: LessonProgressRow | null;
  practical: PracticalSubmissionRow | null;
  lock: LockState;
  notes: LessonNoteRow[];
  attempts: QuizAttemptSummary[];
  /** Concept keys the learner has previously got wrong in this lesson. */
  weakConcepts: string[];
  error: string | null;
}

export async function getLessonPageData(
  user: User,
  lesson: LessonNode,
): Promise<LessonPageData> {
  const supabase = await createClient();
  if (!supabase) {
    return {
      progress: null,
      practical: null,
      lock: { locked: false, blockedBy: [], reason: null },
      notes: [],
      attempts: [],
      weakConcepts: [],
      error: "Database not configured.",
    };
  }

  const { curriculum } = loadCurriculum();

  const [progressResult, notesResult, attemptResult, responseResult, practicalResult] =
    await Promise.all([
      supabase
        .from("lesson_progress")
        .select("lesson_path, status, seconds_spent, scroll_completion, completed_at")
        .eq("user_id", user.id),
      supabase
        .from("notes")
        .select("id, title, body_md, pinned, updated_at")
        .eq("user_id", user.id)
        .eq("scope", "lesson")
        .eq("scope_ref", lesson.path)
        .order("updated_at", { ascending: false }),
      supabase
        .from("quiz_attempts")
        .select("attempt_number, score_percent, passed, attempted_at")
        .eq("user_id", user.id)
        .eq("lesson_path", lesson.path)
        .order("attempt_number", { ascending: false }),
      supabase
        .from("question_responses")
        .select("review_concept, correct")
        .eq("user_id", user.id)
        .eq("lesson_path", lesson.path)
        .eq("correct", false),
      supabase
        .from("submissions")
        .select("status, rubric_check, evidence")
        .eq("user_id", user.id)
        .eq("kind", "practical")
        .eq("ref", lesson.path)
        .maybeSingle(),
    ]);

  const failure = [
    progressResult,
    notesResult,
    attemptResult,
    responseResult,
    practicalResult,
  ].find((r) => r.error)?.error;

  const allProgress = (progressResult.data ?? []).map((row) => {
    const r = row as {
      lesson_path: string;
      status: LessonStatus;
      seconds_spent: number;
      scroll_completion: number;
      completed_at: string | null;
    };
    return {
      lessonPath: r.lesson_path,
      status: r.status,
      secondsSpent: r.seconds_spent,
      scrollCompletion: r.scroll_completion,
      completedAt: r.completed_at ? new Date(r.completed_at) : null,
    };
  });

  const completedLessons = new Set(
    allProgress.filter((r) => r.status === "completed").map((r) => r.lessonPath),
  );

  const practicalRow = practicalResult.data as {
    status: PracticalSubmissionRow["status"];
    rubric_check: Record<string, boolean>;
    evidence: PracticalSubmissionRow["evidence"];
  } | null;

  return {
    progress: allProgress.find((r) => r.lessonPath === lesson.path) ?? null,
    practical: practicalRow
      ? {
          status: practicalRow.status,
          rubricCheck: practicalRow.rubric_check ?? {},
          evidence: practicalRow.evidence ?? {},
        }
      : null,
    lock: evaluateLessonLock({
      prerequisites: lesson.frontmatter.prerequisites,
      completedLessons,
      titleFor: (path) =>
        curriculum.lessonsByPath.get(path)?.frontmatter.title ?? path,
    }),
    notes: (notesResult.data ?? []).map((row) => {
      const r = row as {
        id: string;
        title: string | null;
        body_md: string;
        pinned: boolean;
        updated_at: string;
      };
      return {
        id: r.id,
        title: r.title,
        bodyMd: r.body_md,
        pinned: r.pinned,
        updatedAt: new Date(r.updated_at),
      };
    }),
    attempts: (attemptResult.data ?? []).map((row) => {
      const r = row as {
        attempt_number: number;
        score_percent: number;
        passed: boolean;
        attempted_at: string;
      };
      return {
        attemptNumber: r.attempt_number,
        scorePercent: r.score_percent,
        passed: r.passed,
        attemptedAt: new Date(r.attempted_at),
      };
    }),
    weakConcepts: [
      ...new Set(
        (responseResult.data ?? []).map(
          (row) => (row as { review_concept: string }).review_concept,
        ),
      ),
    ],
    error: failure?.message ?? null,
  };
}
