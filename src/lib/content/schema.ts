import { z } from "zod";

import { SKILL_KEYS, type SkillKey } from "@/lib/domain/skills";

/**
 * Frontmatter contract for every piece of curriculum content.
 *
 * This schema is the guardrail that keeps 250+ lessons maintainable. It runs
 * over every MDX file during `npm run content:check` and inside the manifest
 * build, so the production build fails on a broken prerequisite, a quiz option
 * with no explanation, or an unknown skill key. Content problems surface at
 * build time rather than as a blank panel at 11pm mid-study-session.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

const slugSegment = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "must be lowercase kebab-case (letters, digits and single hyphens)",
  );

/** A fully-qualified lesson reference: `term-1/agency-foundations/what-an-agency-does`. */
export const lessonRef = z
  .string()
  .regex(
    /^term-[1-4]\/[a-z0-9-]+\/[a-z0-9-]+$/,
    "must be a full lesson path like `term-1/module-slug/lesson-slug`",
  );

/** A fully-qualified module reference: `term-1/agency-foundations`. */
export const moduleRef = z
  .string()
  .regex(
    /^term-[1-4]\/[a-z0-9-]+$/,
    "must be a full module path like `term-1/module-slug`",
  );

/**
 * Partial skill→XP map. Written as a loose record then narrowed, because the
 * exhaustive-record behaviour of `z.record` with an enum key differs between
 * validator versions and we explicitly want *some* skills, not all twelve.
 */
export const skillXpMap = z
  .record(z.string(), z.number().int().min(0).max(500))
  .superRefine((value, ctx) => {
    const unknown = Object.keys(value).filter(
      (key) => !(SKILL_KEYS as readonly string[]).includes(key),
    );
    if (unknown.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: `unknown skill key(s): ${unknown.join(", ")}. Valid keys: ${SKILL_KEYS.join(", ")}`,
      });
    }
  })
  .transform((value) => value as Partial<Record<SkillKey, number>>);

export const difficulty = z.enum(["foundation", "intermediate", "advanced"]);
export type Difficulty = z.infer<typeof difficulty>;

/**
 * `draft` content is visibly labelled in the UI, excluded from certification
 * requirements and excluded from term completion percentages. It is how the
 * platform stays honest about what has actually been written.
 */
export const contentStatus = z.enum(["draft", "complete"]);
export type ContentStatus = z.infer<typeof contentStatus>;

/* ------------------------------------------------------------------ */
/* Assessment                                                          */
/* ------------------------------------------------------------------ */

/**
 * Every option carries `why`. A wrong answer must explain why it is wrong;
 * a right answer must explain why it is better. This is enforced, not advised.
 */
const questionOption = z.object({
  text: z.string().min(1),
  correct: z.boolean(),
  why: z
    .string()
    .min(15, "every option needs a real explanation, not a placeholder"),
});

const choiceQuestionKinds = [
  "multiple-choice",
  "multi-select",
  "scenario",
  "debugging",
  "architecture",
  "code-interpretation",
] as const;

const choiceQuestion = z
  .object({
    id: slugSegment,
    type: z.enum(choiceQuestionKinds),
    prompt: z.string().min(1),
    /** Optional code/config/log block shown above the options. */
    code: z.string().optional(),
    codeLang: z.string().optional(),
    options: z.array(questionOption).min(2).max(6),
    /**
     * Concept tag used by weak-area detection and spaced repetition. Getting
     * this question wrong schedules a review card for this concept.
     */
    reviewConcept: slugSegment,
    points: z.number().int().min(1).max(10).default(1),
  })
  .superRefine((q, ctx) => {
    const correctCount = q.options.filter((o) => o.correct).length;
    if (correctCount === 0) {
      ctx.addIssue({
        code: "custom",
        message: `question "${q.id}" has no correct option`,
      });
    }
    if (q.type === "multi-select" && correctCount < 2) {
      ctx.addIssue({
        code: "custom",
        message: `multi-select question "${q.id}" needs at least two correct options`,
      });
    }
    if (q.type !== "multi-select" && correctCount > 1) {
      ctx.addIssue({
        code: "custom",
        message: `question "${q.id}" has ${correctCount} correct options but is not multi-select`,
      });
    }
  });

const openQuestion = z.object({
  id: slugSegment,
  type: z.enum(["short-answer", "client-simulation"]),
  prompt: z.string().min(1),
  /** Criteria the answer is graded against — by you now, by the tutor later. */
  rubric: z.array(z.string().min(1)).min(1),
  /** Shown only after submission, so it teaches rather than gives away. */
  modelAnswer: z.string().min(1),
  reviewConcept: slugSegment,
  points: z.number().int().min(1).max(10).default(3),
});

export const question = z.union([choiceQuestion, openQuestion]);
export type Question = z.infer<typeof question>;
export type ChoiceQuestion = z.infer<typeof choiceQuestion>;
export type OpenQuestion = z.infer<typeof openQuestion>;

export function isChoiceQuestion(q: Question): q is ChoiceQuestion {
  return (choiceQuestionKinds as readonly string[]).includes(q.type);
}

/* ------------------------------------------------------------------ */
/* Practical work                                                      */
/* ------------------------------------------------------------------ */

const evidenceKind = z.enum([
  "repo-url",
  "live-url",
  "screenshot",
  "file",
  "written",
  "external-url",
]);
export type EvidenceKind = z.infer<typeof evidenceKind>;

/**
 * A practical task is the unit of proof. Completing lessons moves a skill to
 * level 2 at most; only approved practicals move it further.
 */
export const practicalTask = z.object({
  title: z.string().min(1),
  brief: z.string().min(40, "a practical brief needs enough detail to act on"),
  estimatedMinutes: z.number().int().min(5).max(1200),
  /** Explicit criteria the learner ticks individually — no blanket "done". */
  rubric: z.array(z.string().min(1)).min(2),
  evidence: z.array(evidenceKind).min(1),
  /** Extra XP on approval, on top of the lesson's base XP. */
  xp: z.number().int().min(0).max(1000).default(80),
  skillXp: skillXpMap.optional(),
});
export type PracticalTask = z.infer<typeof practicalTask>;

/* ------------------------------------------------------------------ */
/* Supporting content blocks                                           */
/* ------------------------------------------------------------------ */

const terminologyEntry = z.object({
  term: z.string().min(1),
  definition: z.string().min(10),
  /** Optional plain-English restatement for jargon-heavy terms. */
  plainEnglish: z.string().optional(),
});
export type TerminologyEntry = z.infer<typeof terminologyEntry>;

const commonMistake = z.object({
  mistake: z.string().min(1),
  correction: z.string().min(1),
  /** Why beginners fall into it — the part that actually prevents recurrence. */
  why: z.string().optional(),
});
export type CommonMistake = z.infer<typeof commonMistake>;

const resourceLink = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  type: z.enum(["docs", "article", "video", "tool", "spec", "template"]),
  note: z.string().optional(),
});
export type ResourceLink = z.infer<typeof resourceLink>;

/* ------------------------------------------------------------------ */
/* Lesson                                                              */
/* ------------------------------------------------------------------ */

export const lessonFrontmatter = z.object({
  title: z.string().min(1),
  /** One sentence. Shown on module listings, search results and the dashboard. */
  summary: z.string().min(20).max(320),
  duration: z.number().int().min(5).max(240),
  difficulty,
  status: contentStatus.default("draft"),
  /** ISO date. Drives the content-maintenance report for vendor-specific material. */
  lastReviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  objectives: z
    .array(z.string().min(1))
    .min(1, "a lesson without a stated objective is a blog post"),
  prerequisites: z.array(lessonRef).default([]),

  /** Base XP for reading. Kept deliberately small — see lib/engines/xp.ts. */
  xp: z.number().int().min(0).max(60).default(15),
  skillXp: skillXpMap.default({}),

  terminology: z.array(terminologyEntry).default([]),
  commonMistakes: z.array(commonMistake).default([]),
  /** Rendered as a prominent warning block. Use for anything that can leak data. */
  securityNote: z.string().optional(),

  quiz: z.array(question).default([]),
  practicalTask: practicalTask.optional(),
  /** Interactive lab ids from `src/lib/domain/labs.ts`. */
  labs: z.array(slugSegment).default([]),

  /** Software Library tool keys referenced by this lesson. */
  software: z.array(slugSegment).default([]),
  resources: z.array(resourceLink).default([]),

  /** Concepts this lesson introduces, seeded as spaced-repetition cards. */
  reviewConcepts: z.array(slugSegment).default([]),
});

export type LessonFrontmatter = z.infer<typeof lessonFrontmatter>;

/* ------------------------------------------------------------------ */
/* Module                                                              */
/* ------------------------------------------------------------------ */

export const moduleFrontmatter = z.object({
  title: z.string().min(1),
  summary: z.string().min(20).max(400),
  status: contentStatus.default("draft"),
  objectives: z.array(z.string().min(1)).min(1),
  /** Whole modules that must be complete before this one opens. */
  prerequisites: z.array(moduleRef).default([]),
  /** Primary skills this module advances — drives module cards and the tree. */
  skills: z.array(z.enum(SKILL_KEYS)).min(1),
  software: z.array(slugSegment).default([]),
  /** Optional end-of-module exam. Pass mark is a percentage. */
  exam: z
    .object({
      title: z.string().min(1),
      passMark: z.number().int().min(50).max(100).default(80),
      /** Questions drawn at random from the module's lesson quizzes. */
      questionCount: z.number().int().min(5).max(60).default(15),
      timeLimitMinutes: z.number().int().min(5).max(240).optional(),
      /** Additional exam-only questions not attached to any single lesson. */
      questions: z.array(question).default([]),
    })
    .optional(),
});

export type ModuleFrontmatter = z.infer<typeof moduleFrontmatter>;

/* ------------------------------------------------------------------ */
/* Term                                                                */
/* ------------------------------------------------------------------ */

export const termFrontmatter = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  summary: z.string().min(20),
  objective: z.string().min(20),
  status: contentStatus.default("draft"),
  /** The milestone awarded on term completion, e.g. `technical-client-ready`. */
  milestone: slugSegment,
  /** Certifications that belong to this term. */
  certifications: z.array(slugSegment).default([]),
});

export type TermFrontmatter = z.infer<typeof termFrontmatter>;
