import type { User } from "@supabase/supabase-js";

import { loadCurriculum } from "@/lib/content/loader";
import { LABS } from "@/lib/domain/labs";
import { addDays, toDayKey, type DayKey } from "@/lib/engines/streak";
import {
  dueCards,
  forecast,
  retentionStats,
  strugglingConcepts,
  type ReviewCard,
} from "@/lib/engines/srs";
import { createClient } from "@/lib/supabase/server";

/**
 * Study planning: what is due, what is next, and what happened this week.
 */

export interface ReviewDeck {
  cards: ReviewCard[];
  due: ReviewCard[];
  stats: ReturnType<typeof retentionStats>;
  forecast: ReturnType<typeof forecast>;
  struggling: ReturnType<typeof strugglingConcepts>;
  today: DayKey;
  error: string | null;
}

export async function getReviewDeck(user: User): Promise<ReviewDeck> {
  const supabase = await createClient();
  const today = toDayKey(new Date());

  if (!supabase) {
    return {
      cards: [],
      due: [],
      stats: retentionStats([], today),
      forecast: forecast([], today, 14),
      struggling: [],
      today,
      error: "Database not configured.",
    };
  }

  const [profileResult, cardResult] = await Promise.all([
    supabase.from("profiles").select("time_zone").eq("id", user.id).maybeSingle(),
    supabase.from("review_cards").select("*").eq("user_id", user.id),
  ]);

  const timeZone =
    (profileResult.data as { time_zone?: string } | null)?.time_zone ??
    "Australia/Sydney";
  const localToday = toDayKey(new Date(), timeZone);

  const cards: ReviewCard[] = (cardResult.data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      conceptKey: r.concept_key as string,
      lessonPath: r.lesson_path as string,
      ease: r.ease as number,
      intervalDays: r.interval_days as number,
      repetitions: r.repetitions as number,
      dueOn: r.due_on as string,
      lapses: r.lapses as number,
      fromMistake: r.from_mistake as boolean,
    };
  });

  return {
    cards,
    due: dueCards(cards, localToday, 20),
    stats: retentionStats(cards, localToday),
    forecast: forecast(cards, localToday, 14),
    struggling: strugglingConcepts(cards, 5),
    today: localToday,
    error: cardResult.error?.message ?? null,
  };
}

export interface WeeklySummary {
  from: DayKey;
  to: DayKey;
  minutes: number;
  lessonsCompleted: number;
  labsSolved: number;
  quizAttempts: number;
  averageQuizScore: number | null;
  submissions: number;
  prospectsAdded: number;
  activities: Array<{ kind: string; summary: string; occurredAt: string }>;
  error: string | null;
}

export async function getWeeklySummary(user: User): Promise<WeeklySummary> {
  const supabase = await createClient();
  const to = toDayKey(new Date());
  const from = addDays(to, -6);

  const empty: WeeklySummary = {
    from,
    to,
    minutes: 0,
    lessonsCompleted: 0,
    labsSolved: 0,
    quizAttempts: 0,
    averageQuizScore: null,
    submissions: 0,
    prospectsAdded: 0,
    activities: [],
    error: null,
  };

  if (!supabase) return { ...empty, error: "Database not configured." };

  const since = new Date();
  since.setDate(since.getDate() - 6);
  const sinceIso = since.toISOString();

  const [sessions, activity, quizzes] = await Promise.all([
    supabase
      .from("study_sessions")
      .select("local_day, seconds")
      .eq("user_id", user.id)
      .gte("local_day", from),
    supabase
      .from("activity_log")
      .select("kind, summary, occurred_at")
      .eq("user_id", user.id)
      .gte("occurred_at", sinceIso)
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("quiz_attempts")
      .select("score_percent")
      .eq("user_id", user.id)
      .gte("attempted_at", sinceIso),
  ]);

  const activities = (activity.data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      kind: r.kind as string,
      summary: r.summary as string,
      occurredAt: r.occurred_at as string,
    };
  });

  const scores = (quizzes.data ?? []).map(
    (row) => (row as { score_percent: number }).score_percent,
  );

  return {
    from,
    to,
    minutes: Math.round(
      (sessions.data ?? []).reduce(
        (sum, row) => sum + (row as { seconds: number }).seconds,
        0,
      ) / 60,
    ),
    lessonsCompleted: activities.filter((a) => a.kind === "lesson_completed").length,
    labsSolved: activities.filter((a) => a.kind === "lab_solved").length,
    quizAttempts: scores.length,
    averageQuizScore:
      scores.length === 0
        ? null
        : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    submissions: activities.filter((a) => a.kind === "practical_submitted").length,
    prospectsAdded: activities.filter((a) => a.kind === "milestone").length,
    activities,
    error:
      [sessions, activity, quizzes].find((r) => r.error)?.error?.message ?? null,
  };
}

export interface TodayPlanItem {
  kind: "lesson" | "review" | "lab" | "practical" | "business";
  title: string;
  detail: string;
  minutes: number;
  href: string;
}

/**
 * Builds a study plan for today that fits the target duration.
 *
 * Deliberately opinionated about order: review first, because a concept you are
 * about to forget is worth more than a new one; then the next lesson; then a
 * lab; then business action, which is the thing that most easily gets deferred
 * forever.
 */
export function buildTodayPlan(options: {
  targetMinutes: number;
  dueReviewCount: number;
  nextLessonPath: string | null;
  nextLessonTitle: string | null;
  nextLessonMinutes: number;
  unsolvedLabId: string | null;
  unsolvedLabTitle: string | null;
  unsolvedLabMinutes: number;
  outstandingPracticalPath: string | null;
  outstandingPracticalTitle: string | null;
  validationCount: number;
}): TodayPlanItem[] {
  const plan: TodayPlanItem[] = [];
  let remaining = options.targetMinutes;

  if (options.dueReviewCount > 0) {
    const minutes = Math.min(15, Math.max(5, options.dueReviewCount));
    plan.push({
      kind: "review",
      title: `Review ${options.dueReviewCount} concept${options.dueReviewCount === 1 ? "" : "s"}`,
      detail: "Due today. A concept about to fade is worth more than a new one.",
      minutes,
      href: "/review",
    });
    remaining -= minutes;
  }

  if (options.nextLessonPath && remaining > 10) {
    const minutes = Math.min(remaining, options.nextLessonMinutes);
    plan.push({
      kind: "lesson",
      title: options.nextLessonTitle ?? "Next lesson",
      detail: "Continue the curriculum.",
      minutes,
      href: `/course/${options.nextLessonPath}`,
    });
    remaining -= minutes;
  }

  if (options.outstandingPracticalPath && remaining > 10) {
    const minutes = Math.min(remaining, 25);
    plan.push({
      kind: "practical",
      title: options.outstandingPracticalTitle ?? "Practical task",
      detail: "Evidence, not reading. This is what moves a skill past Practised.",
      minutes,
      href: `/course/${options.outstandingPracticalPath}#practical-task`,
    });
    remaining -= minutes;
  }

  if (options.unsolvedLabId && remaining > 10) {
    const minutes = Math.min(remaining, options.unsolvedLabMinutes);
    plan.push({
      kind: "lab",
      title: options.unsolvedLabTitle ?? "Practical lab",
      detail: "A situation rather than a question.",
      minutes,
      href: `/labs/${options.unsolvedLabId}`,
    });
    remaining -= minutes;
  }

  if (options.validationCount < 5) {
    plan.push({
      kind: "business",
      title: "One market validation conversation",
      detail: `${options.validationCount} of 5 done. The part of the program that cannot be studied.`,
      minutes: Math.max(10, Math.min(remaining, 15)),
      href: "/validation",
    });
  }

  return plan;
}

/** The next lesson to study: the first published, incomplete, unblocked one. */
export function findNextLesson(completed: ReadonlySet<string>) {
  const { curriculum } = loadCurriculum();
  for (const path of curriculum.lessonOrder) {
    const lesson = curriculum.lessonsByPath.get(path);
    if (!lesson || lesson.frontmatter.status !== "complete") continue;
    if (completed.has(path)) continue;
    const blocked = lesson.frontmatter.prerequisites.some((p) => !completed.has(p));
    if (blocked) continue;
    return lesson;
  }
  return null;
}

export function findNextLab(solved: ReadonlySet<string>) {
  return LABS.find((lab) => !solved.has(lab.id)) ?? null;
}
