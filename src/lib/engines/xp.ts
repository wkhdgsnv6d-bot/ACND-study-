import type { SkillKey } from "@/lib/domain/skills";

/**
 * XP engine.
 *
 * XP is an append-only ledger, never a mutable counter. Totals are always
 * recomputed from events, so a bug in one award can be fixed by correcting the
 * event rather than by reconciling a drifting integer.
 *
 * The award table is deliberately lopsided. Reading the entire program without
 * doing any practical work reaches roughly 15% of total XP — see
 * `xp.test.ts`, which asserts that ratio so a future edit can't quietly turn
 * this back into a clicking simulator.
 */

export const XP_SOURCE_TYPES = [
  "lesson-read",
  "quiz-passed",
  "lab-solved",
  "practical-approved",
  "assignment-approved",
  "exam-passed",
  "project-submitted",
  "certification-earned",
  "business-milestone",
  "review-session",
] as const;

export type XpSourceType = (typeof XP_SOURCE_TYPES)[number];

/** Sources that require producing something, rather than consuming something. */
export const PRACTICAL_XP_SOURCES: readonly XpSourceType[] = [
  "lab-solved",
  "practical-approved",
  "assignment-approved",
  "project-submitted",
  "business-milestone",
];

export interface XpEvent {
  id: string;
  sourceType: XpSourceType;
  /** Lesson path, lab id, assignment id, milestone key… */
  sourceId: string;
  amount: number;
  skillXp: Partial<Record<SkillKey, number>>;
  awardedAt: Date;
}

/** Default awards. Content may override within the schema's allowed range. */
export const XP_AWARDS = {
  lessonRead: 15,
  quizPassed: 15,
  /** Perfect score on first attempt — small, to discourage answer-hunting. */
  quizFirstTryBonus: 10,
  labSolved: 90,
  practicalApproved: 80,
  assignmentApproved: 220,
  examPassed: 200,
  projectSubmitted: 400,
  certificationEarned: 750,
  /** Completing a full spaced-repetition session for the day. */
  reviewSession: 20,
} as const;

/**
 * Real-business milestones are the highest-value events in the system, because
 * they are the only ones that cannot be faked by studying harder.
 */
export const MILESTONE_XP: Record<string, number> = {
  "first-validation-interview": 200,
  "five-validation-interviews": 500,
  "first-prospect-contacted": 150,
  "first-reply": 200,
  "first-discovery-call": 600,
  "first-proposal-sent": 600,
  "first-client-won": 2000,
  "first-payment-collected": 2000,
  "first-project-delivered": 1500,
  "first-recurring-revenue": 2000,
  "first-testimonial": 400,
  "five-clients": 2500,
  "first-contractor": 1500,
  "ten-thousand-monthly-revenue": 3000,
};

export interface XpTotals {
  total: number;
  bySource: Record<XpSourceType, number>;
  /** XP earned from producing work, as opposed to consuming lessons. */
  practicalXp: number;
  /** 0–1. Low values mean you are reading much more than you are building. */
  practicalRatio: number;
}

export function totalXp(events: readonly XpEvent[]): XpTotals {
  const bySource = Object.fromEntries(
    XP_SOURCE_TYPES.map((t) => [t, 0]),
  ) as Record<XpSourceType, number>;

  let total = 0;
  let practicalXp = 0;

  for (const event of events) {
    total += event.amount;
    bySource[event.sourceType] += event.amount;
    if (PRACTICAL_XP_SOURCES.includes(event.sourceType)) {
      practicalXp += event.amount;
    }
  }

  return {
    total,
    bySource,
    practicalXp,
    practicalRatio: total === 0 ? 0 : practicalXp / total,
  };
}

/** XP accumulated per skill branch, from the same ledger. */
export function skillXpTotals(
  events: readonly XpEvent[],
): Partial<Record<SkillKey, number>> {
  const totals: Partial<Record<SkillKey, number>> = {};
  for (const event of events) {
    for (const [skill, amount] of Object.entries(event.skillXp)) {
      const key = skill as SkillKey;
      totals[key] = (totals[key] ?? 0) + amount;
    }
  }
  return totals;
}

/* ------------------------------------------------------------------ */
/* Learner level                                                       */
/* ------------------------------------------------------------------ */

/**
 * Overall learner level. The curve widens as it climbs so early progress feels
 * responsive without making later levels trivial. Level N requires
 * `500 * N^1.6` cumulative XP, rounded to the nearest 50.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round((500 * Math.pow(level - 1, 1.6)) / 50) * 50;
}

export interface LevelProgress {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** 0–1 progress through the current level. */
  fraction: number;
}

export function levelFromXp(total: number): LevelProgress {
  let level = 1;
  while (xpForLevel(level + 1) <= total && level < 100) level += 1;

  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpIntoLevel = total - currentLevelXp;
  const xpForNextLevel = nextLevelXp - currentLevelXp;

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpForNextLevel,
    fraction: xpForNextLevel === 0 ? 1 : xpIntoLevel / xpForNextLevel,
  };
}

/* ------------------------------------------------------------------ */
/* Award construction                                                  */
/* ------------------------------------------------------------------ */

/**
 * Quiz XP scales with score but only pays out on a pass, and the first-try
 * bonus cannot be farmed by retaking.
 */
export function quizXp(options: {
  scorePercent: number;
  passMark: number;
  attemptNumber: number;
}): number {
  const { scorePercent, passMark, attemptNumber } = options;
  if (scorePercent < passMark) return 0;
  const base = XP_AWARDS.quizPassed;
  const perfectFirstTry = scorePercent === 100 && attemptNumber === 1;
  return base + (perfectFirstTry ? XP_AWARDS.quizFirstTryBonus : 0);
}

/**
 * Labs pay less on repeat attempts — solving it once is the learning event,
 * and re-running a solved lab shouldn't inflate the ledger.
 */
export function labXp(options: {
  baseXp?: number;
  attemptNumber: number;
  alreadySolved: boolean;
}): number {
  if (options.alreadySolved) return 0;
  const base = options.baseXp ?? XP_AWARDS.labSolved;
  if (options.attemptNumber <= 1) return base;
  if (options.attemptNumber <= 3) return Math.round(base * 0.75);
  return Math.round(base * 0.5);
}

export function milestoneXp(key: string): number {
  return MILESTONE_XP[key] ?? 500;
}
