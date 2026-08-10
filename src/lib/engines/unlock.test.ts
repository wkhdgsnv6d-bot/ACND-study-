import { describe, expect, it } from "vitest";

import type { BusinessMetrics } from "@/lib/engines/certification";
import {
  DEFAULT_TERM_4_CONFIG,
  evaluateLessonLock,
  evaluateTerm4Unlock,
  evaluateTermLock,
  TERM_4_LOCK_MESSAGE,
  type Term4UnlockConfig,
} from "@/lib/engines/unlock";

function metrics(partial: Partial<BusinessMetrics> = {}): BusinessMetrics {
  return {
    monthlyRevenue: 0,
    mrr: 0,
    activeClients: 0,
    totalRevenue: 0,
    contractors: 0,
    ...partial,
  };
}

describe("Term 4 unlock", () => {
  it("is locked for a business with no revenue, and says why", () => {
    const state = evaluateTerm4Unlock(DEFAULT_TERM_4_CONFIG, metrics());

    expect(state.unlocked).toBe(false);
    expect(state.reason).toBe("locked");
    expect(state.message).toBe(TERM_4_LOCK_MESSAGE);
    expect(state.thresholds).toHaveLength(4);
    expect(state.thresholds.every((t) => !t.met)).toBe(true);
  });

  it("unlocks on any single threshold in `any` mode", () => {
    const state = evaluateTerm4Unlock(
      DEFAULT_TERM_4_CONFIG,
      metrics({ contractors: 1 }),
    );

    expect(state.unlocked).toBe(true);
    expect(state.reason).toBe("thresholds-met");
  });

  it("requires every threshold in `all` mode", () => {
    const config: Term4UnlockConfig = { ...DEFAULT_TERM_4_CONFIG, mode: "all" };

    expect(evaluateTerm4Unlock(config, metrics({ contractors: 1 })).unlocked).toBe(
      false,
    );
    expect(
      evaluateTerm4Unlock(
        config,
        metrics({ contractors: 1, monthlyRevenue: 10_000, mrr: 3_000, activeClients: 5 }),
      ).unlocked,
    ).toBe(true);
  });

  it("reports per-threshold progress so the lock screen can show bars", () => {
    const state = evaluateTerm4Unlock(
      DEFAULT_TERM_4_CONFIG,
      metrics({ mrr: 1_500, activeClients: 2 }),
    );

    const mrr = state.thresholds.find((t) => t.key === "mrr")!;
    expect(mrr.progress).toBe(0.5);
    expect(mrr.format).toBe("currency");

    const clients = state.thresholds.find((t) => t.key === "activeClients")!;
    expect(clients.progress).toBeCloseTo(0.4);
    expect(clients.format).toBe("count");
  });

  it("surfaces the nearest threshold as the thing to aim at", () => {
    const state = evaluateTerm4Unlock(
      DEFAULT_TERM_4_CONFIG,
      metrics({ mrr: 2_400, monthlyRevenue: 1_000 }),
    );

    expect(state.nearest?.key).toBe("mrr");
  });

  it("honours a manual override and records the stated reason", () => {
    const state = evaluateTerm4Unlock(
      {
        ...DEFAULT_TERM_4_CONFIG,
        manualOverride: {
          unlockedAt: new Date("2026-05-01"),
          reason: "Taking on a partner, need the finance material now.",
        },
      },
      metrics(),
    );

    expect(state.unlocked).toBe(true);
    expect(state.reason).toBe("manual-override");
    expect(state.overrideReason).toContain("partner");
  });

  it("opens entirely when gating is switched off", () => {
    const state = evaluateTerm4Unlock(
      { ...DEFAULT_TERM_4_CONFIG, enabled: false },
      metrics(),
    );

    expect(state.unlocked).toBe(true);
    expect(state.reason).toBe("disabled");
  });

  it("stays locked when no thresholds are configured at all", () => {
    const state = evaluateTerm4Unlock(
      { enabled: true, mode: "any", thresholds: {}, manualOverride: null },
      metrics({ mrr: 999_999 }),
    );

    expect(state.unlocked).toBe(false);
    expect(state.nearest).toBeNull();
  });
});

describe("evaluateTermLock", () => {
  it("never locks terms 1 to 3", () => {
    const term4 = evaluateTerm4Unlock(DEFAULT_TERM_4_CONFIG, metrics());
    for (const term of [1, 2, 3] as const) {
      expect(evaluateTermLock(term, term4).locked).toBe(false);
    }
  });

  it("locks term 4 in step with the unlock state", () => {
    const locked = evaluateTerm4Unlock(DEFAULT_TERM_4_CONFIG, metrics());
    expect(evaluateTermLock(4, locked).locked).toBe(true);
    expect(evaluateTermLock(4, locked).reason).toBe(TERM_4_LOCK_MESSAGE);

    const open = evaluateTerm4Unlock(DEFAULT_TERM_4_CONFIG, metrics({ mrr: 5_000 }));
    expect(evaluateTermLock(4, open).locked).toBe(false);
  });
});

describe("prerequisite locks", () => {
  it("is open when there are no prerequisites", () => {
    const lock = evaluateLessonLock({
      prerequisites: [],
      completedLessons: new Set(),
    });

    expect(lock.locked).toBe(false);
    expect(lock.reason).toBeNull();
  });

  it("names the single blocking lesson", () => {
    const lock = evaluateLessonLock({
      prerequisites: ["term-1/apis-and-webhooks/what-is-an-api"],
      completedLessons: new Set(),
      titleFor: () => "What is an API?",
    });

    expect(lock.locked).toBe(true);
    expect(lock.reason).toContain("What is an API?");
    expect(lock.blockedBy).toHaveLength(1);
  });

  it("opens once every prerequisite is complete", () => {
    const lock = evaluateLessonLock({
      prerequisites: ["a", "b"],
      completedLessons: new Set(["a", "b"]),
    });

    expect(lock.locked).toBe(false);
  });
});
