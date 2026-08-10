import { describe, expect, it } from "vitest";

import {
  labXp,
  levelFromXp,
  quizXp,
  skillXpTotals,
  totalXp,
  XP_AWARDS,
  xpForLevel,
  type XpEvent,
} from "@/lib/engines/xp";

function event(partial: Partial<XpEvent> & Pick<XpEvent, "sourceType" | "amount">): XpEvent {
  return {
    id: crypto.randomUUID(),
    sourceId: "x",
    skillXp: {},
    awardedAt: new Date("2026-01-01"),
    ...partial,
  };
}

describe("totalXp", () => {
  it("sums the ledger and separates practical from consumed XP", () => {
    const totals = totalXp([
      event({ sourceType: "lesson-read", amount: 15 }),
      event({ sourceType: "lesson-read", amount: 15 }),
      event({ sourceType: "lab-solved", amount: 90 }),
      event({ sourceType: "business-milestone", amount: 2000 }),
    ]);

    expect(totals.total).toBe(2120);
    expect(totals.bySource["lesson-read"]).toBe(30);
    expect(totals.practicalXp).toBe(2090);
    expect(totals.practicalRatio).toBeCloseTo(2090 / 2120);
  });

  it("returns a zero ratio rather than NaN for an empty ledger", () => {
    expect(totalXp([]).practicalRatio).toBe(0);
  });
});

describe("the reading-only ceiling", () => {
  /**
   * This is the anti-clicking guarantee, asserted rather than assumed. A
   * hypothetical learner who reads all 250 lessons and passes every knowledge
   * check — but builds nothing, submits nothing and sells nothing — should
   * reach only a small fraction of the program's total XP.
   */
  it("caps a read-everything-build-nothing learner well below a quarter of total XP", () => {
    const LESSONS = 250;
    const MODULES = 42;
    const LABS = 30;
    const ASSIGNMENTS = 24;
    const PROJECTS = 8;
    const CERTIFICATIONS = 12;

    const readingOnly =
      LESSONS * XP_AWARDS.lessonRead + LESSONS * XP_AWARDS.quizPassed;

    const doingTheWork =
      LABS * XP_AWARDS.labSolved +
      ASSIGNMENTS * XP_AWARDS.assignmentApproved +
      MODULES * XP_AWARDS.examPassed +
      PROJECTS * XP_AWARDS.projectSubmitted +
      CERTIFICATIONS * XP_AWARDS.certificationEarned +
      // A conservative subset of business milestones.
      (2000 + 2000 + 1500 + 2000 + 600 + 600);

    const ratio = readingOnly / (readingOnly + doingTheWork);

    expect(ratio).toBeLessThan(0.25);
  });
});

describe("quizXp", () => {
  it("pays nothing below the pass mark", () => {
    expect(quizXp({ scorePercent: 70, passMark: 80, attemptNumber: 1 })).toBe(0);
  });

  it("pays a bonus only for a perfect first attempt", () => {
    expect(quizXp({ scorePercent: 100, passMark: 80, attemptNumber: 1 })).toBe(
      XP_AWARDS.quizPassed + XP_AWARDS.quizFirstTryBonus,
    );
    expect(quizXp({ scorePercent: 100, passMark: 80, attemptNumber: 2 })).toBe(
      XP_AWARDS.quizPassed,
    );
  });
});

describe("labXp", () => {
  it("pays nothing for re-running a solved lab", () => {
    expect(labXp({ attemptNumber: 1, alreadySolved: true })).toBe(0);
  });

  it("tapers with attempts so brute force is worth less than thinking", () => {
    const first = labXp({ attemptNumber: 1, alreadySolved: false });
    const third = labXp({ attemptNumber: 3, alreadySolved: false });
    const tenth = labXp({ attemptNumber: 10, alreadySolved: false });

    expect(first).toBeGreaterThan(third);
    expect(third).toBeGreaterThan(tenth);
    expect(tenth).toBeGreaterThan(0);
  });
});

describe("skillXpTotals", () => {
  it("accumulates per branch across events", () => {
    const totals = skillXpTotals([
      event({ sourceType: "lesson-read", amount: 15, skillXp: { api: 20, web: 5 } }),
      event({ sourceType: "lab-solved", amount: 90, skillXp: { api: 40 } }),
    ]);

    expect(totals.api).toBe(60);
    expect(totals.web).toBe(5);
    expect(totals.voice).toBeUndefined();
  });
});

describe("levelFromXp", () => {
  it("starts at level 1 with zero XP", () => {
    const progress = levelFromXp(0);
    expect(progress.level).toBe(1);
    expect(progress.fraction).toBe(0);
  });

  it("is monotonic — more XP never lowers the level", () => {
    let previous = 0;
    for (let xp = 0; xp < 200_000; xp += 733) {
      const level = levelFromXp(xp).level;
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  it("reports progress within the current level", () => {
    const target = xpForLevel(5);
    const justInside = levelFromXp(target);
    expect(justInside.level).toBe(5);
    expect(justInside.xpIntoLevel).toBe(0);

    const halfway = levelFromXp(
      target + Math.floor((xpForLevel(6) - target) / 2),
    );
    expect(halfway.level).toBe(5);
    expect(halfway.fraction).toBeGreaterThan(0.4);
    expect(halfway.fraction).toBeLessThan(0.6);
  });
});
