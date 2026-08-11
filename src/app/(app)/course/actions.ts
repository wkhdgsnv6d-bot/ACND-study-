"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";

import { loadCurriculum } from "@/lib/content/loader";
import { isChoiceQuestion } from "@/lib/content/schema";
import type { SkillKey } from "@/lib/domain/skills";
import { createCard } from "@/lib/engines/srs";
import { toDayKey } from "@/lib/engines/streak";
import { quizXp, type XpSourceType } from "@/lib/engines/xp";
import { completionEligibility } from "@/lib/engines/completion";
import { createClient, requireUser } from "@/lib/supabase/server";

/**
 * Lesson progress, study time and knowledge checks.
 *
 * Three rules are enforced here rather than in the UI, because a disabled
 * button is a suggestion and a hidden answer is not a guarantee:
 *
 * 1. Completion criteria are re-checked against stored progress before a lesson
 *    can be marked complete.
 * 2. Quizzes are graded on the server. Correct answers and explanations never
 *    reach the browser until after submission.
 * 3. XP is awarded through an idempotent insert, so replaying an action cannot
 *    inflate the ledger.
 */

export interface ActionResult {
  ok: boolean;
  message: string | null;
}

const LESSON_PATH = z
  .string()
  .regex(/^term-[1-4]\/[a-z0-9-]+\/[a-z0-9-]+$/, "invalid lesson path");

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Awards XP idempotently. The unique index on
 * (user_id, source_type, source_id) means a duplicate is a no-op rather than a
 * second award, so retries and double-clicks are harmless.
 */
async function awardXp(
  supabase: SupabaseClient,
  user: User,
  award: {
    sourceType: XpSourceType;
    sourceId: string;
    amount: number;
    skillXp?: Partial<Record<SkillKey, number>>;
  },
): Promise<void> {
  if (award.amount <= 0) return;

  await supabase.from("xp_events").upsert(
    {
      user_id: user.id,
      source_type: award.sourceType.replaceAll("-", "_"),
      source_id: award.sourceId,
      amount: award.amount,
      skill_xp: award.skillXp ?? {},
    },
    { onConflict: "user_id,source_type,source_id", ignoreDuplicates: true },
  );
}

async function logActivity(
  supabase: SupabaseClient,
  user: User,
  entry: { kind: string; ref?: string; summary: string },
): Promise<void> {
  await supabase.from("activity_log").insert({
    user_id: user.id,
    kind: entry.kind,
    ref: entry.ref ?? null,
    summary: entry.summary,
  });
}

async function userTimeZone(
  supabase: SupabaseClient,
  user: User,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("time_zone")
    .eq("id", user.id)
    .maybeSingle();
  return (data as { time_zone?: string } | null)?.time_zone ?? "Australia/Sydney";
}

/* ------------------------------------------------------------------ */
/* Reading progress                                                    */
/* ------------------------------------------------------------------ */

const progressSchema = z.object({
  lessonPath: LESSON_PATH,
  /** Active seconds since the last report. Bounded to reject implausible jumps. */
  secondsDelta: z.number().int().min(0).max(600),
  scrollCompletion: z.number().min(0).max(1),
});

/**
 * Records reading time and scroll depth. Called periodically while the lesson
 * is open and visible.
 *
 * `secondsDelta` is capped per call and only counts time the tab was actually
 * visible, so leaving a lesson open overnight does not manufacture progress.
 */
export async function recordReadingProgress(input: {
  lessonPath: string;
  secondsDelta: number;
  scrollCompletion: number;
}): Promise<ActionResult> {
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid progress payload." };

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Database not configured." };

  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id, status, seconds_spent, scroll_completion")
    .eq("user_id", user.id)
    .eq("lesson_path", parsed.data.lessonPath)
    .maybeSingle();

  const current = existing as {
    id: string;
    status: string;
    seconds_spent: number;
    scroll_completion: number;
  } | null;

  const secondsSpent = (current?.seconds_spent ?? 0) + parsed.data.secondsDelta;
  // Scroll depth only ever moves forward — scrolling back up is not un-reading.
  const scrollCompletion = Math.max(
    current?.scroll_completion ?? 0,
    parsed.data.scrollCompletion,
  );

  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_path: parsed.data.lessonPath,
      status: current?.status === "completed" ? "completed" : "in_progress",
      started_at: current ? undefined : new Date().toISOString(),
      seconds_spent: secondsSpent,
      scroll_completion: scrollCompletion,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_path" },
  );

  if (error) return { ok: false, message: error.message };

  if (parsed.data.secondsDelta > 0) {
    const timeZone = await userTimeZone(supabase, user);
    await supabase.from("study_sessions").insert({
      user_id: user.id,
      activity: "lesson",
      ref: parsed.data.lessonPath,
      started_at: new Date(Date.now() - parsed.data.secondsDelta * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      seconds: parsed.data.secondsDelta,
      local_day: toDayKey(new Date(), timeZone),
    });
  }

  return { ok: true, message: null };
}

/* ------------------------------------------------------------------ */
/* Completion                                                          */
/* ------------------------------------------------------------------ */

export async function completeLesson(lessonPath: string): Promise<ActionResult> {
  const parsed = LESSON_PATH.safeParse(lessonPath);
  if (!parsed.success) return { ok: false, message: "Invalid lesson." };

  const { curriculum } = loadCurriculum();
  const lesson = curriculum.lessonsByPath.get(parsed.data);
  if (!lesson) return { ok: false, message: "That lesson does not exist." };

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Database not configured." };

  const { data } = await supabase
    .from("lesson_progress")
    .select("status, seconds_spent, scroll_completion")
    .eq("user_id", user.id)
    .eq("lesson_path", lesson.path)
    .maybeSingle();

  const current = data as {
    status: string;
    seconds_spent: number;
    scroll_completion: number;
  } | null;

  if (current?.status === "completed") {
    return { ok: true, message: "Already complete." };
  }

  // Re-checked here rather than trusted from the client. The UI disables the
  // button, but the server decides.
  const eligibility = completionEligibility({
    durationMinutes: lesson.frontmatter.duration,
    secondsSpent: current?.seconds_spent ?? 0,
    scrollCompletion: current?.scroll_completion ?? 0,
  });

  if (!eligibility.eligible) {
    return { ok: false, message: eligibility.reason ?? "Not eligible yet." };
  }

  // Prerequisites are re-checked too, so a direct action call cannot skip them.
  if (lesson.frontmatter.prerequisites.length > 0) {
    const { data: completedRows } = await supabase
      .from("lesson_progress")
      .select("lesson_path")
      .eq("user_id", user.id)
      .eq("status", "completed");

    const completed = new Set(
      (completedRows ?? []).map((r) => (r as { lesson_path: string }).lesson_path),
    );
    const missing = lesson.frontmatter.prerequisites.filter((p) => !completed.has(p));
    if (missing.length > 0) {
      return { ok: false, message: "Complete this lesson's prerequisites first." };
    }
  }

  const { error } = await supabase
    .from("lesson_progress")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("lesson_path", lesson.path);

  if (error) return { ok: false, message: error.message };

  await awardXp(supabase, user, {
    sourceType: "lesson-read",
    sourceId: lesson.path,
    amount: lesson.frontmatter.xp,
    skillXp: lesson.frontmatter.skillXp,
  });

  await seedReviewCards(supabase, user, {
    lessonPath: lesson.path,
    concepts: lesson.frontmatter.reviewConcepts,
    fromMistake: false,
  });

  await logActivity(supabase, user, {
    kind: "lesson_completed",
    ref: lesson.path,
    summary: `Completed “${lesson.frontmatter.title}”`,
  });

  revalidatePath(`/course/${lesson.termSlug}/${lesson.moduleSlug}/${lesson.slug}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Lesson complete." };
}

/**
 * Creates spaced-repetition cards. Existing cards are left alone — a concept
 * already in rotation should keep its schedule rather than be reset by
 * re-reading the lesson that introduced it.
 */
async function seedReviewCards(
  supabase: SupabaseClient,
  user: User,
  options: { lessonPath: string; concepts: readonly string[]; fromMistake: boolean },
): Promise<void> {
  if (options.concepts.length === 0) return;

  const timeZone = await userTimeZone(supabase, user);
  const today = toDayKey(new Date(), timeZone);

  const rows = options.concepts.map((conceptKey) => {
    const card = createCard({
      id: conceptKey,
      conceptKey,
      lessonPath: options.lessonPath,
      today,
      fromMistake: options.fromMistake,
    });
    return {
      user_id: user.id,
      concept_key: card.conceptKey,
      lesson_path: card.lessonPath,
      ease: card.ease,
      interval_days: card.intervalDays,
      repetitions: card.repetitions,
      due_on: card.dueOn,
      lapses: card.lapses,
      from_mistake: card.fromMistake,
    };
  });

  await supabase
    .from("review_cards")
    .upsert(rows, { onConflict: "user_id,concept_key", ignoreDuplicates: true });
}

/* ------------------------------------------------------------------ */
/* Knowledge checks                                                    */
/* ------------------------------------------------------------------ */

export interface QuestionResult {
  questionId: string;
  correct: boolean;
  /** Indices the learner chose, or their written answer. */
  given: number[] | string;
  /** The full option list with explanations — returned only after grading. */
  options?: Array<{ text: string; correct: boolean; why: string }>;
  /** For open questions. */
  rubric?: string[];
  modelAnswer?: string;
  reviewConcept: string;
}

export interface QuizResult extends ActionResult {
  scorePercent: number;
  passed: boolean;
  attemptNumber: number;
  xpAwarded: number;
  results: QuestionResult[];
  /** Concepts scheduled for review because they were answered incorrectly. */
  scheduledForReview: string[];
}

const QUIZ_PASS_MARK = 80;

const answerSchema = z.record(
  z.string(),
  z.union([z.array(z.number().int().min(0).max(10)), z.string().max(4000)]),
);

/**
 * Grades a knowledge check.
 *
 * The client renders questions with `correct` and `why` stripped out, so the
 * answers are not sitting in the page source. Grading happens here against the
 * content files, and the explanations come back with the result — which is also
 * when they are most useful.
 *
 * Open questions (short answer, client simulation) cannot be auto-graded. They
 * are returned with their rubric and model answer for self-assessment and are
 * excluded from the score rather than silently counted as correct.
 */
export async function submitQuiz(input: {
  lessonPath: string;
  answers: Record<string, number[] | string>;
}): Promise<QuizResult> {
  const empty: QuizResult = {
    ok: false,
    message: null,
    scorePercent: 0,
    passed: false,
    attemptNumber: 0,
    xpAwarded: 0,
    results: [],
    scheduledForReview: [],
  };

  const pathParsed = LESSON_PATH.safeParse(input.lessonPath);
  const answersParsed = answerSchema.safeParse(input.answers);
  if (!pathParsed.success || !answersParsed.success) {
    return { ...empty, message: "Invalid submission." };
  }

  const { curriculum } = loadCurriculum();
  const lesson = curriculum.lessonsByPath.get(pathParsed.data);
  if (!lesson) return { ...empty, message: "That lesson does not exist." };

  const questions = lesson.frontmatter.quiz;
  if (questions.length === 0) {
    return { ...empty, message: "This lesson has no knowledge check." };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ...empty, message: "Database not configured." };

  const answers = answersParsed.data;
  const results: QuestionResult[] = [];
  let earned = 0;
  let available = 0;

  for (const question of questions) {
    const given = answers[question.id];

    if (isChoiceQuestion(question)) {
      const chosen = Array.isArray(given) ? given : [];
      const correctIndices = question.options
        .map((option, index) => (option.correct ? index : -1))
        .filter((index) => index >= 0);

      const correct =
        chosen.length === correctIndices.length &&
        chosen.every((index) => correctIndices.includes(index));

      available += question.points;
      if (correct) earned += question.points;

      results.push({
        questionId: question.id,
        correct,
        given: chosen,
        options: question.options,
        reviewConcept: question.reviewConcept,
      });
    } else {
      // Not machine-gradable. Shown with its rubric for honest self-assessment,
      // and excluded from the score rather than counted as a free mark.
      results.push({
        questionId: question.id,
        correct: false,
        given: typeof given === "string" ? given : "",
        rubric: question.rubric,
        modelAnswer: question.modelAnswer,
        reviewConcept: question.reviewConcept,
      });
    }
  }

  const scorePercent = available === 0 ? 0 : Math.round((earned / available) * 100);
  const passed = scorePercent >= QUIZ_PASS_MARK;

  const { count } = await supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("lesson_path", lesson.path);

  const attemptNumber = (count ?? 0) + 1;

  const { data: attemptRow, error: attemptError } = await supabase
    .from("quiz_attempts")
    .insert({
      user_id: user.id,
      lesson_path: lesson.path,
      attempt_number: attemptNumber,
      score_percent: scorePercent,
      passed,
      answers,
    })
    .select("id")
    .single();

  if (attemptError) return { ...empty, message: attemptError.message };

  const attemptId = (attemptRow as { id: string }).id;

  await supabase.from("question_responses").insert(
    results.map((result) => ({
      user_id: user.id,
      attempt_id: attemptId,
      question_id: result.questionId,
      lesson_path: lesson.path,
      review_concept: result.reviewConcept,
      correct: result.correct,
      answer: { given: result.given },
    })),
  );

  // A wrong answer is the strongest signal the platform gets about what you do
  // not know, so it schedules a review card immediately.
  const missedConcepts = [
    ...new Set(
      results
        .filter((r) => !r.correct && r.options !== undefined)
        .map((r) => r.reviewConcept),
    ),
  ];

  if (missedConcepts.length > 0) {
    await seedReviewCards(supabase, user, {
      lessonPath: lesson.path,
      concepts: missedConcepts,
      fromMistake: true,
    });
  }

  const xpAwarded = quizXp({ scorePercent, passMark: QUIZ_PASS_MARK, attemptNumber });
  if (xpAwarded > 0) {
    await awardXp(supabase, user, {
      sourceType: "quiz-passed",
      sourceId: lesson.path,
      amount: xpAwarded,
      skillXp: lesson.frontmatter.skillXp,
    });
  }

  await logActivity(supabase, user, {
    kind: "quiz_attempted",
    ref: lesson.path,
    summary: `Scored ${scorePercent}% on “${lesson.frontmatter.title}”`,
  });

  revalidatePath(`/course/${lesson.termSlug}/${lesson.moduleSlug}/${lesson.slug}`);
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: null,
    scorePercent,
    passed,
    attemptNumber,
    xpAwarded,
    results,
    scheduledForReview: missedConcepts,
  };
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

const noteSchema = z.object({
  id: z.string().uuid().optional(),
  scope: z.enum(["lesson", "module", "software", "project", "general"]),
  scopeRef: z.string().max(200).optional(),
  title: z.string().trim().max(200).optional(),
  bodyMd: z.string().max(50_000),
  pinned: z.boolean().optional(),
});

export async function saveNote(input: {
  id?: string;
  scope: "lesson" | "module" | "software" | "project" | "general";
  scopeRef?: string;
  title?: string;
  bodyMd: string;
  pinned?: boolean;
  revalidate?: string;
}): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid note." };
  if (parsed.data.bodyMd.trim().length === 0) {
    return { ok: false, message: "Nothing to save." };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Database not configured." };

  const payload = {
    user_id: user.id,
    scope: parsed.data.scope,
    scope_ref: parsed.data.scopeRef ?? null,
    title: parsed.data.title || null,
    body_md: parsed.data.bodyMd,
    pinned: parsed.data.pinned ?? false,
    updated_at: new Date().toISOString(),
  };

  const { error } = parsed.data.id
    ? await supabase
        .from("notes")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("user_id", user.id)
    : await supabase.from("notes").insert(payload);

  if (error) return { ok: false, message: error.message };

  if (input.revalidate) revalidatePath(input.revalidate);
  return { ok: true, message: "Saved." };
}

export async function deleteNote(
  id: string,
  revalidate?: string,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, message: "Invalid note." };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Database not configured." };

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, message: error.message };
  if (revalidate) revalidatePath(revalidate);
  return { ok: true, message: "Deleted." };
}

/* ------------------------------------------------------------------ */
/* Practical tasks                                                     */
/* ------------------------------------------------------------------ */

const evidenceSchema = z.object({
  repoUrl: z.string().trim().url().optional().or(z.literal("")),
  liveUrl: z.string().trim().url().optional().or(z.literal("")),
  externalUrl: z.string().trim().url().optional().or(z.literal("")),
  screenshots: z.array(z.string().trim().url()).max(10).default([]),
  writeUp: z.string().trim().max(20_000).optional(),
});

const practicalSchema = z.object({
  lessonPath: LESSON_PATH,
  /** Rubric criterion → ticked. Each is confirmed individually, never in bulk. */
  rubricCheck: z.record(z.string(), z.boolean()),
  evidence: evidenceSchema,
  submit: z.boolean(),
});

/**
 * Saves or submits a lesson's practical task.
 *
 * Submission requires every rubric criterion ticked and every declared evidence
 * kind present. Both are re-checked here rather than trusted from the form,
 * because this is the boundary where "I read it" becomes "I can do it" — the
 * distinction the whole platform is built on.
 *
 * Approval is self-attested; there is no external examiner. What the server
 * guarantees is that skipping a requirement is a deliberate act, and that
 * whatever was submitted is recorded permanently against the claim.
 */
export async function savePracticalTask(input: {
  lessonPath: string;
  rubricCheck: Record<string, boolean>;
  evidence: {
    repoUrl?: string;
    liveUrl?: string;
    externalUrl?: string;
    screenshots?: string[];
    writeUp?: string;
  };
  submit: boolean;
}): Promise<ActionResult> {
  const parsed = practicalSchema.safeParse({
    ...input,
    evidence: { ...input.evidence, screenshots: input.evidence.screenshots ?? [] },
  });
  if (!parsed.success) {
    return { ok: false, message: "Check the evidence links — one is not a valid URL." };
  }

  const { curriculum } = loadCurriculum();
  const lesson = curriculum.lessonsByPath.get(parsed.data.lessonPath);
  const task = lesson?.frontmatter.practicalTask;
  if (!lesson || !task) {
    return { ok: false, message: "This lesson has no practical task." };
  }

  const { rubricCheck, evidence } = parsed.data;

  if (parsed.data.submit) {
    const unticked = task.rubric.filter((criterion) => !rubricCheck[criterion]);
    if (unticked.length > 0) {
      return {
        ok: false,
        message: `${unticked.length} ${unticked.length === 1 ? "criterion" : "criteria"} still unticked. Submit only what you have actually done.`,
      };
    }

    const missing = task.evidence.filter((kind) => {
      switch (kind) {
        case "repo-url":
          return !evidence.repoUrl;
        case "live-url":
          return !evidence.liveUrl;
        case "external-url":
          return !evidence.externalUrl;
        case "screenshot":
          return (evidence.screenshots ?? []).length === 0;
        case "written":
          return !evidence.writeUp || evidence.writeUp.length < 50;
        case "file":
          return false;
      }
    });

    if (missing.length > 0) {
      return {
        ok: false,
        message: `Missing evidence: ${missing.join(", ").replaceAll("-", " ")}.`,
      };
    }
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Database not configured." };

  const status = parsed.data.submit ? "approved" : "draft";

  const { error } = await supabase.from("submissions").upsert(
    {
      user_id: user.id,
      kind: "practical",
      ref: lesson.path,
      status,
      body_md: evidence.writeUp ?? null,
      evidence,
      rubric_check: rubricCheck,
      submitted_at: parsed.data.submit ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind,ref" },
  );

  if (error) return { ok: false, message: error.message };

  if (parsed.data.submit) {
    await awardXp(supabase, user, {
      sourceType: "practical-approved",
      sourceId: lesson.path,
      amount: task.xp,
      skillXp: task.skillXp ?? lesson.frontmatter.skillXp,
    });

    await logActivity(supabase, user, {
      kind: "practical_submitted",
      ref: lesson.path,
      summary: `Submitted “${task.title}”`,
    });
  }

  revalidatePath(`/course/${lesson.termSlug}/${lesson.moduleSlug}/${lesson.slug}`);
  revalidatePath("/assignments");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: parsed.data.submit ? "Submitted." : "Draft saved.",
  };
}
