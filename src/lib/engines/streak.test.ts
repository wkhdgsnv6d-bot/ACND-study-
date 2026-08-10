import { describe, expect, it } from "vitest";

import {
  addDays,
  computeStreak,
  daysBetween,
  MINIMUM_STREAK_MINUTES,
  studyHistogram,
  toDayKey,
  type StudyDay,
} from "@/lib/engines/streak";

const TODAY = "2026-08-10";

function run(days: Array<[offset: number, minutes: number]>): StudyDay[] {
  return days.map(([offset, minutes]) => ({ day: addDays(TODAY, offset), minutes }));
}

describe("day arithmetic", () => {
  it("adds and subtracts days across month boundaries", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("handles leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("measures the gap between days", () => {
    expect(daysBetween("2026-08-01", "2026-08-10")).toBe(9);
    expect(daysBetween("2026-08-10", "2026-08-01")).toBe(-9);
  });

  it("derives a day key in a given timezone, not UTC", () => {
    // 2026-08-10T22:30Z is already the 11th in Sydney.
    const instant = new Date("2026-08-10T22:30:00Z");
    expect(toDayKey(instant, "Australia/Sydney")).toBe("2026-08-11");
    expect(toDayKey(instant, "UTC")).toBe("2026-08-10");
  });
});

describe("computeStreak", () => {
  it("is zero with no sessions", () => {
    const state = computeStreak([], TODAY);

    expect(state.current).toBe(0);
    expect(state.longest).toBe(0);
    expect(state.atRisk).toBe(false);
    expect(state.lastStudiedDay).toBeNull();
  });

  it("ignores days below the minimum — opening the app is not studying", () => {
    const state = computeStreak(
      run([
        [0, MINIMUM_STREAK_MINUTES - 1],
        [-1, MINIMUM_STREAK_MINUTES - 1],
      ]),
      TODAY,
    );

    expect(state.current).toBe(0);
  });

  it("sums multiple sessions in the same day toward the minimum", () => {
    const state = computeStreak(run([[0, 6], [0, 6]]), TODAY);

    expect(state.current).toBe(1);
  });

  it("counts consecutive qualifying days", () => {
    const state = computeStreak(
      run([
        [0, 30],
        [-1, 30],
        [-2, 30],
        [-3, 30],
      ]),
      TODAY,
    );

    expect(state.current).toBe(4);
  });

  it("keeps the streak alive when today has not happened yet", () => {
    const state = computeStreak(
      run([
        [-1, 30],
        [-2, 30],
      ]),
      TODAY,
    );

    expect(state.current).toBe(2);
    expect(state.atRisk).toBe(true);
    expect(state.minutesToSecureToday).toBe(MINIMUM_STREAK_MINUTES);
  });

  it("forgives one missed day inside the week", () => {
    const state = computeStreak(
      run([
        [0, 30],
        [-1, 30],
        // -2 missed
        [-3, 30],
        [-4, 30],
      ]),
      TODAY,
    );

    expect(state.current).toBe(4);
    expect(state.graceUsedThisWeek).toBe(1);
  });

  it("does not forgive two missed days in the same week", () => {
    const state = computeStreak(
      run([
        [0, 30],
        // -1 missed
        [-2, 30],
        // -3 missed
        [-4, 30],
      ]),
      TODAY,
    );

    expect(state.current).toBe(2);
  });

  it("breaks on a two-day gap", () => {
    const state = computeStreak(
      run([
        [0, 30],
        [-3, 30],
        [-4, 30],
      ]),
      TODAY,
    );

    expect(state.current).toBe(1);
  });

  it("remembers the longest historical run even after a break", () => {
    const state = computeStreak(
      run([
        [0, 30],
        [-20, 30],
        [-21, 30],
        [-22, 30],
        [-23, 30],
        [-24, 30],
      ]),
      TODAY,
    );

    expect(state.current).toBe(1);
    expect(state.longest).toBe(5);
  });

  it("counts qualifying days in the trailing week", () => {
    const state = computeStreak(
      run([
        [0, 30],
        [-2, 30],
        [-5, 30],
        [-9, 30],
      ]),
      TODAY,
    );

    expect(state.daysThisWeek).toBe(3);
  });

  it("reports how many minutes remain to secure today", () => {
    const state = computeStreak(run([[0, 4]]), TODAY, { minimumMinutes: 10 });

    expect(state.minutesToSecureToday).toBe(6);
  });
});

describe("studyHistogram", () => {
  it("zero-fills every day in the window", () => {
    const histogram = studyHistogram(run([[0, 30], [-3, 15]]), TODAY, 7);

    expect(histogram).toHaveLength(7);
    expect(histogram[6]).toEqual({ day: TODAY, minutes: 30 });
    expect(histogram[3]).toEqual({ day: addDays(TODAY, -3), minutes: 15 });
    expect(histogram[0]!.minutes).toBe(0);
  });

  it("returns days in chronological order", () => {
    const histogram = studyHistogram([], TODAY, 5);
    const days = histogram.map((h) => h.day);

    expect([...days].sort()).toEqual(days);
  });
});
