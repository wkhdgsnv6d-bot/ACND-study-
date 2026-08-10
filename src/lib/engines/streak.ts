/**
 * Study-streak engine.
 *
 * Streaks work on *local calendar days*, expressed as `YYYY-MM-DD` strings.
 * Deliberately not on `Date` objects: a study session at 11pm in Sydney and one
 * at 1am the next morning are different days to the learner and the same UTC
 * day to a naive implementation. The caller converts to the user's timezone
 * once, at the edge, and everything downstream is string arithmetic.
 *
 * A streak requires meaningful activity, not an app open — see
 * `MINIMUM_STREAK_MINUTES`.
 */

export type DayKey = string; // YYYY-MM-DD

/** Below this, a day does not count. Opening the dashboard is not studying. */
export const MINIMUM_STREAK_MINUTES = 10;

/**
 * One missed day per rolling week is forgiven. Long streaks should reward
 * consistency, not punish a single sick day into a restart — which is the
 * point at which most people abandon the habit entirely.
 */
export const GRACE_DAYS_PER_WEEK = 1;

export interface StudyDay {
  day: DayKey;
  minutes: number;
}

export interface StreakState {
  current: number;
  longest: number;
  /** Days studied in the trailing 7 days, including today. */
  daysThisWeek: number;
  /** True when today has not yet met the minimum. */
  atRisk: boolean;
  /** Minutes still needed today to keep the streak alive. */
  minutesToSecureToday: number;
  lastStudiedDay: DayKey | null;
  /** Grace days consumed inside the current streak's trailing week. */
  graceUsedThisWeek: number;
}

export function toDayKey(date: Date, timeZone?: string): DayKey {
  if (!timeZone) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  // `en-CA` yields ISO-shaped YYYY-MM-DD, which is exactly the format we want.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(day: DayKey, delta: number): DayKey {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: DayKey, to: DayKey): number {
  const parse = (day: DayKey) => {
    const [y, m, d] = day.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

export function computeStreak(
  sessions: readonly StudyDay[],
  today: DayKey,
  options: { minimumMinutes?: number; graceDaysPerWeek?: number } = {},
): StreakState {
  const minimum = options.minimumMinutes ?? MINIMUM_STREAK_MINUTES;
  const grace = options.graceDaysPerWeek ?? GRACE_DAYS_PER_WEEK;

  const minutesByDay = new Map<DayKey, number>();
  for (const session of sessions) {
    minutesByDay.set(session.day, (minutesByDay.get(session.day) ?? 0) + session.minutes);
  }

  const qualifying = new Set(
    [...minutesByDay.entries()].filter(([, m]) => m >= minimum).map(([day]) => day),
  );

  const todayMinutes = minutesByDay.get(today) ?? 0;
  const todayQualifies = todayMinutes >= minimum;

  // Walk backwards from today (or yesterday, if today isn't done yet), spending
  // grace on gaps of exactly one day and stopping at anything larger.
  let cursor = todayQualifies ? today : addDays(today, -1);
  let current = 0;
  let graceUsed = 0;
  let daysWalked = 0;

  while (daysWalked < 3650) {
    if (qualifying.has(cursor)) {
      current += 1;
      cursor = addDays(cursor, -1);
      daysWalked += 1;
      continue;
    }

    // A single missed day may be forgiven, but only if the streak resumes and
    // we have not already spent our allowance inside this trailing week.
    const previous = addDays(cursor, -1);
    const withinRecentWeek = daysWalked < 7;
    if (
      qualifying.has(previous) &&
      graceUsed < grace &&
      withinRecentWeek &&
      current > 0
    ) {
      graceUsed += 1;
      cursor = previous;
      daysWalked += 1;
      continue;
    }
    break;
  }

  const sortedDays = [...qualifying].sort();
  const longest = Math.max(current, longestRun(sortedDays));

  const weekStart = addDays(today, -6);
  const daysThisWeek = sortedDays.filter(
    (day) => daysBetween(weekStart, day) >= 0 && daysBetween(day, today) >= 0,
  ).length;

  return {
    current,
    longest,
    daysThisWeek,
    atRisk: current > 0 && !todayQualifies,
    minutesToSecureToday: todayQualifies ? 0 : minimum - todayMinutes,
    lastStudiedDay: sortedDays.length > 0 ? sortedDays[sortedDays.length - 1]! : null,
    graceUsedThisWeek: graceUsed,
  };
}

/** Longest run of consecutive qualifying days, ignoring grace. */
function longestRun(sortedDays: readonly DayKey[]): number {
  let longest = 0;
  let run = 0;
  let previous: DayKey | null = null;

  for (const day of sortedDays) {
    run = previous !== null && daysBetween(previous, day) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = day;
  }

  return longest;
}

/** Study minutes per day over a window, zero-filled — ready for a chart. */
export function studyHistogram(
  sessions: readonly StudyDay[],
  today: DayKey,
  days: number,
): StudyDay[] {
  const minutesByDay = new Map<DayKey, number>();
  for (const session of sessions) {
    minutesByDay.set(session.day, (minutesByDay.get(session.day) ?? 0) + session.minutes);
  }

  return Array.from({ length: days }, (_, index) => {
    const day = addDays(today, -(days - 1 - index));
    return { day, minutes: minutesByDay.get(day) ?? 0 };
  });
}
