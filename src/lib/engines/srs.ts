import { addDays, daysBetween, type DayKey } from "@/lib/engines/streak";

/**
 * Spaced-repetition engine (SM-2, adapted).
 *
 * The platform's job is not only to teach a concept once but to make sure it is
 * still there three months later when a client asks about it on a call. Cards
 * are created from two sources:
 *
 *  - `reviewConcepts` declared by a lesson (scheduled on completion), and
 *  - `reviewConcept` tags on questions you got *wrong* (scheduled immediately).
 *
 * The second source is the important one: it turns a failed quiz from a score
 * into a study plan.
 */

export type Rating = "again" | "hard" | "good" | "easy";

export interface ReviewCard {
  id: string;
  conceptKey: string;
  /** Lesson the concept belongs to, so a card can link back to its source. */
  lessonPath: string;
  /** SM-2 ease factor. Lower means the card returns sooner. */
  ease: number;
  /** Current interval in days. */
  intervalDays: number;
  /** Consecutive successful reviews. Resets to 0 on `again`. */
  repetitions: number;
  dueOn: DayKey;
  lapses: number;
  /** Set when the card was created from a wrong answer rather than a lesson. */
  fromMistake: boolean;
}

export const MIN_EASE = 1.3;
export const DEFAULT_EASE = 2.5;

const RATING_QUALITY: Record<Rating, number> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

export function createCard(options: {
  id: string;
  conceptKey: string;
  lessonPath: string;
  today: DayKey;
  fromMistake?: boolean;
}): ReviewCard {
  const fromMistake = options.fromMistake ?? false;
  return {
    id: options.id,
    conceptKey: options.conceptKey,
    lessonPath: options.lessonPath,
    ease: DEFAULT_EASE,
    intervalDays: 0,
    repetitions: 0,
    // A concept you just got wrong comes back tomorrow; one you just learned
    // correctly gets a couple of days of consolidation first.
    dueOn: addDays(options.today, fromMistake ? 1 : 2),
    lapses: 0,
    fromMistake,
  };
}

export function reviewCard(
  card: ReviewCard,
  rating: Rating,
  today: DayKey,
): ReviewCard {
  const quality = RATING_QUALITY[rating];

  if (quality < 3) {
    // Failed. Reset the repetition chain and bring it back tomorrow, but keep
    // the ease penalty modest so one bad day doesn't bury the card in reviews.
    return {
      ...card,
      ease: Math.max(MIN_EASE, card.ease - 0.2),
      intervalDays: 1,
      repetitions: 0,
      lapses: card.lapses + 1,
      dueOn: addDays(today, 1),
    };
  }

  const repetitions = card.repetitions + 1;
  const ease = Math.max(
    MIN_EASE,
    card.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  let intervalDays: number;
  if (repetitions === 1) {
    intervalDays = 1;
  } else if (repetitions === 2) {
    intervalDays = 6;
  } else {
    intervalDays = Math.round(card.intervalDays * ease);
  }

  // `hard` should not extend as far as `good` did.
  if (rating === "hard") intervalDays = Math.max(1, Math.round(intervalDays * 0.7));
  // Cap runaway intervals; a two-year gap on a client-facing concept is useless.
  intervalDays = Math.min(intervalDays, 240);

  return {
    ...card,
    ease,
    intervalDays,
    repetitions,
    dueOn: addDays(today, intervalDays),
  };
}

export function dueCards(
  cards: readonly ReviewCard[],
  today: DayKey,
  limit?: number,
): ReviewCard[] {
  const due = cards
    .filter((card) => daysBetween(card.dueOn, today) >= 0)
    .sort((a, b) => {
      // Most overdue first, then cards born from mistakes, then weakest ease.
      const overdueDiff = daysBetween(a.dueOn, today) - daysBetween(b.dueOn, today);
      if (overdueDiff !== 0) return -overdueDiff;
      if (a.fromMistake !== b.fromMistake) return a.fromMistake ? -1 : 1;
      return a.ease - b.ease;
    });

  return limit === undefined ? due : due.slice(0, limit);
}

export interface ReviewForecast {
  day: DayKey;
  count: number;
}

/** Upcoming review load, so the Today page can warn about a spike. */
export function forecast(
  cards: readonly ReviewCard[],
  today: DayKey,
  days: number,
): ReviewForecast[] {
  const counts = new Map<DayKey, number>();
  for (const card of cards) {
    const key = daysBetween(card.dueOn, today) >= 0 ? today : card.dueOn;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, index) => {
    const day = addDays(today, index);
    return { day, count: counts.get(day) ?? 0 };
  });
}

export interface RetentionStats {
  totalCards: number;
  dueToday: number;
  /** Cards with 3+ successful reps and a healthy ease — genuinely retained. */
  matured: number;
  /** Cards that have lapsed 3+ times. These signal a concept never really landed. */
  struggling: number;
  averageEase: number | null;
}

export function retentionStats(
  cards: readonly ReviewCard[],
  today: DayKey,
): RetentionStats {
  if (cards.length === 0) {
    return {
      totalCards: 0,
      dueToday: 0,
      matured: 0,
      struggling: 0,
      averageEase: null,
    };
  }

  return {
    totalCards: cards.length,
    dueToday: cards.filter((c) => daysBetween(c.dueOn, today) >= 0).length,
    matured: cards.filter((c) => c.repetitions >= 3 && c.intervalDays >= 21).length,
    struggling: cards.filter((c) => c.lapses >= 3).length,
    averageEase: cards.reduce((sum, c) => sum + c.ease, 0) / cards.length,
  };
}

/**
 * Concepts that keep failing, ranked worst-first. Feeds the "weak areas" panel
 * and the weekly review — the platform should tell you what you are bad at.
 */
export function strugglingConcepts(
  cards: readonly ReviewCard[],
  limit = 5,
): Array<{ conceptKey: string; lessonPath: string; lapses: number; ease: number }> {
  return [...cards]
    .filter((c) => c.lapses > 0)
    .sort((a, b) => b.lapses - a.lapses || a.ease - b.ease)
    .slice(0, limit)
    .map((c) => ({
      conceptKey: c.conceptKey,
      lessonPath: c.lessonPath,
      lapses: c.lapses,
      ease: c.ease,
    }));
}
