import { describe, expect, it } from "vitest";

import {
  completionEligibility,
  REQUIRED_SCROLL_COMPLETION,
  requiredDwellSeconds,
} from "@/lib/engines/completion";

describe("requiredDwellSeconds", () => {
  it("scales with the lesson's estimated duration", () => {
    expect(requiredDwellSeconds(10)).toBe(240);
    expect(requiredDwellSeconds(20)).toBe(480);
  });

  it("caps at ten minutes, which binds from about 25 minutes upward", () => {
    expect(requiredDwellSeconds(25)).toBe(600);
    expect(requiredDwellSeconds(60)).toBe(600);
    expect(requiredDwellSeconds(240)).toBe(600);
  });
});

describe("completionEligibility", () => {
  const lesson = { durationMinutes: 30 };

  it("refuses a lesson opened and immediately dismissed", () => {
    const result = completionEligibility({
      ...lesson,
      secondsSpent: 2,
      scrollCompletion: 0,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("Read to the end of the lesson first.");
  });

  it("refuses a fast scroll to the bottom", () => {
    const result = completionEligibility({
      ...lesson,
      secondsSpent: 5,
      scrollCompletion: 1,
    });

    expect(result.eligible).toBe(false);
    expect(result.scrollMet).toBe(true);
    expect(result.dwellMet).toBe(false);
    expect(result.reason).toContain("more minute");
  });

  it("refuses time spent without reaching the end", () => {
    const result = completionEligibility({
      ...lesson,
      secondsSpent: 3600,
      scrollCompletion: 0.4,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("not reached the end");
  });

  it("accepts genuine reading", () => {
    const result = completionEligibility({
      ...lesson,
      secondsSpent: requiredDwellSeconds(30),
      scrollCompletion: REQUIRED_SCROLL_COMPLETION,
    });

    expect(result.eligible).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("does not demand scrolling the final 15%, where footers live", () => {
    const result = completionEligibility({
      ...lesson,
      secondsSpent: 900,
      scrollCompletion: 0.86,
    });

    expect(result.eligible).toBe(true);
  });

  it("reports the remaining minutes accurately", () => {
    const result = completionEligibility({
      durationMinutes: 10,
      secondsSpent: 120,
      scrollCompletion: 1,
    });

    // 240 required, 120 spent — two minutes left.
    expect(result.reason).toBe("About 2 more minutes of reading time.");
  });
});
