import { describe, expect, it } from "vitest";

import { addDays } from "@/lib/engines/streak";
import {
  createCard,
  DEFAULT_EASE,
  dueCards,
  forecast,
  MIN_EASE,
  retentionStats,
  reviewCard,
  strugglingConcepts,
  type ReviewCard,
} from "@/lib/engines/srs";

const TODAY = "2026-08-10";

function card(partial: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: "c1",
    conceptKey: "http-status-codes",
    lessonPath: "term-1/apis-and-webhooks/http-status-codes",
    ease: DEFAULT_EASE,
    intervalDays: 0,
    repetitions: 0,
    dueOn: TODAY,
    lapses: 0,
    fromMistake: false,
    ...partial,
  };
}

describe("createCard", () => {
  it("brings a mistake-born card back sooner than a freshly learned one", () => {
    const mistake = createCard({
      id: "a",
      conceptKey: "k",
      lessonPath: "p",
      today: TODAY,
      fromMistake: true,
    });
    const learned = createCard({
      id: "b",
      conceptKey: "k",
      lessonPath: "p",
      today: TODAY,
    });

    expect(mistake.dueOn).toBe(addDays(TODAY, 1));
    expect(learned.dueOn).toBe(addDays(TODAY, 2));
  });
});

describe("reviewCard", () => {
  it("resets the chain and returns tomorrow on `again`", () => {
    const reviewed = reviewCard(
      card({ repetitions: 4, intervalDays: 30 }),
      "again",
      TODAY,
    );

    expect(reviewed.repetitions).toBe(0);
    expect(reviewed.intervalDays).toBe(1);
    expect(reviewed.lapses).toBe(1);
    expect(reviewed.dueOn).toBe(addDays(TODAY, 1));
    expect(reviewed.ease).toBeLessThan(DEFAULT_EASE);
  });

  it("never drops ease below the floor", () => {
    let current = card();
    for (let i = 0; i < 30; i += 1) {
      current = reviewCard(current, "again", TODAY);
    }

    expect(current.ease).toBe(MIN_EASE);
  });

  it("follows the 1-day then 6-day ladder on the first two successes", () => {
    const first = reviewCard(card(), "good", TODAY);
    expect(first.intervalDays).toBe(1);

    const second = reviewCard(first, "good", addDays(TODAY, 1));
    expect(second.intervalDays).toBe(6);
  });

  it("multiplies by ease from the third success onward", () => {
    const first = reviewCard(card(), "good", TODAY);
    const second = reviewCard(first, "good", TODAY);
    const third = reviewCard(second, "good", TODAY);

    expect(third.intervalDays).toBe(Math.round(6 * second.ease));
    expect(third.repetitions).toBe(3);
  });

  it("extends less on `hard` than on `good`", () => {
    const base = card({ repetitions: 3, intervalDays: 20 });

    expect(reviewCard(base, "hard", TODAY).intervalDays).toBeLessThan(
      reviewCard(base, "good", TODAY).intervalDays,
    );
  });

  it("raises ease on `easy` and lowers it on `hard`", () => {
    const base = card({ repetitions: 3, intervalDays: 20 });

    expect(reviewCard(base, "easy", TODAY).ease).toBeGreaterThan(base.ease);
    expect(reviewCard(base, "hard", TODAY).ease).toBeLessThan(base.ease);
  });

  it("caps the interval so a concept never disappears for years", () => {
    let current = card({ repetitions: 3, intervalDays: 200, ease: 2.8 });
    for (let i = 0; i < 10; i += 1) {
      current = reviewCard(current, "easy", TODAY);
    }

    expect(current.intervalDays).toBeLessThanOrEqual(240);
  });
});

describe("dueCards", () => {
  it("returns only cards due today or earlier", () => {
    const due = dueCards(
      [
        card({ id: "past", dueOn: addDays(TODAY, -3) }),
        card({ id: "today", dueOn: TODAY }),
        card({ id: "future", dueOn: addDays(TODAY, 2) }),
      ],
      TODAY,
    );

    expect(due.map((c) => c.id)).toEqual(["past", "today"]);
  });

  it("puts the most overdue card first", () => {
    const due = dueCards(
      [
        card({ id: "a", dueOn: addDays(TODAY, -1) }),
        card({ id: "b", dueOn: addDays(TODAY, -9) }),
      ],
      TODAY,
    );

    expect(due[0]!.id).toBe("b");
  });

  it("prioritises mistake-born cards on an equal due date", () => {
    const due = dueCards(
      [
        card({ id: "learned", dueOn: TODAY, fromMistake: false }),
        card({ id: "missed", dueOn: TODAY, fromMistake: true }),
      ],
      TODAY,
    );

    expect(due[0]!.id).toBe("missed");
  });

  it("respects a session limit", () => {
    const cards = Array.from({ length: 40 }, (_, i) =>
      card({ id: String(i), dueOn: TODAY }),
    );

    expect(dueCards(cards, TODAY, 15)).toHaveLength(15);
  });
});

describe("forecast", () => {
  it("rolls everything overdue into today rather than hiding it", () => {
    const result = forecast(
      [
        card({ id: "a", dueOn: addDays(TODAY, -5) }),
        card({ id: "b", dueOn: addDays(TODAY, -1) }),
        card({ id: "c", dueOn: addDays(TODAY, 3) }),
      ],
      TODAY,
      7,
    );

    expect(result[0]).toEqual({ day: TODAY, count: 2 });
    expect(result[3]).toEqual({ day: addDays(TODAY, 3), count: 1 });
  });
});

describe("retentionStats", () => {
  it("handles an empty deck without dividing by zero", () => {
    const stats = retentionStats([], TODAY);

    expect(stats.totalCards).toBe(0);
    expect(stats.averageEase).toBeNull();
  });

  it("separates matured cards from struggling ones", () => {
    const stats = retentionStats(
      [
        card({ id: "m", repetitions: 4, intervalDays: 40 }),
        card({ id: "s", lapses: 4 }),
        card({ id: "n" }),
      ],
      TODAY,
    );

    expect(stats.matured).toBe(1);
    expect(stats.struggling).toBe(1);
    expect(stats.totalCards).toBe(3);
  });
});

describe("strugglingConcepts", () => {
  it("ranks the concepts that keep failing", () => {
    const struggling = strugglingConcepts([
      card({ id: "a", conceptKey: "idempotency", lapses: 5 }),
      card({ id: "b", conceptKey: "oauth", lapses: 2 }),
      card({ id: "c", conceptKey: "dns", lapses: 0 }),
    ]);

    expect(struggling.map((s) => s.conceptKey)).toEqual(["idempotency", "oauth"]);
  });
});
