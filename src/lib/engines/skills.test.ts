import { describe, expect, it } from "vitest";

import {
  computeAllSkillStates,
  computeSkillState,
  isTechnicallyClientReady,
  SKILL_XP_THRESHOLDS,
  weakestSkills,
  type SkillEvidenceInput,
} from "@/lib/engines/skills";

function input(partial: Partial<SkillEvidenceInput> = {}): SkillEvidenceInput {
  return {
    xp: 0,
    practicalCount: 0,
    hasClientReadyProject: false,
    hasCertification: false,
    ...partial,
  };
}

describe("the no-clicking-through guarantee", () => {
  /**
   * The single most important assertion in the codebase. Someone who reads
   * every lesson in a branch — earning enough XP for level 5 — but who has
   * never submitted a practical must not be described as Client Ready.
   */
  it("caps a reader with unlimited XP and zero practicals at Practised", () => {
    const state = computeSkillState("automation", input({ xp: 999_999 }));

    expect(state.level).toBe(2);
    expect(state.levelName).toBe("Practised");
    expect(state.xpLevel).toBe(5);
    expect(state.evidenceLevel).toBe(2);
    expect(state.cappedBy).toBe("evidence");
    expect(state.capReason).toContain("proof");
  });

  it("explains exactly how many practicals unlock the next level", () => {
    const state = computeSkillState("web", input({ xp: 5000, practicalCount: 1 }));

    expect(state.level).toBe(2);
    expect(state.nextLevel?.practicalsNeeded).toBe(1);
    expect(state.capReason).toContain("1 more approved practical");
  });
});

describe("computeSkillState", () => {
  it("reaches Client Ready with both coverage and evidence", () => {
    const state = computeSkillState(
      "crm",
      input({ xp: SKILL_XP_THRESHOLDS[3], practicalCount: 2 }),
    );

    expect(state.level).toBe(3);
    expect(state.levelName).toBe("Client Ready");
    expect(state.cappedBy).toBeNull();
  });

  it("caps at Advanced without a client-ready project", () => {
    const state = computeSkillState(
      "web",
      input({
        xp: SKILL_XP_THRESHOLDS[5],
        practicalCount: 6,
        hasCertification: true,
        hasClientReadyProject: false,
      }),
    );

    expect(state.level).toBe(4);
    expect(state.cappedBy).toBe("client-ready-project");
  });

  it("caps at Advanced without the branch certification", () => {
    const state = computeSkillState(
      "web",
      input({
        xp: SKILL_XP_THRESHOLDS[5],
        practicalCount: 6,
        hasCertification: false,
        hasClientReadyProject: true,
      }),
    );

    expect(state.level).toBe(4);
    expect(state.cappedBy).toBe("certification");
  });

  it("awards Mastered only when every gate is satisfied", () => {
    const state = computeSkillState(
      "web",
      input({
        xp: SKILL_XP_THRESHOLDS[5],
        practicalCount: 6,
        hasCertification: true,
        hasClientReadyProject: true,
      }),
    );

    expect(state.level).toBe(5);
    expect(state.nextLevel).toBeNull();
  });

  it("reports an XP cap when evidence has outpaced coverage", () => {
    const state = computeSkillState("api", input({ xp: 50, practicalCount: 6 }));

    expect(state.level).toBe(0);
    expect(state.cappedBy).toBe("xp");
    expect(state.capReason).toContain("more XP");
  });

  it("never returns a level outside 0–5", () => {
    for (const xp of [0, 99, 100, 2599, 2600, 1_000_000]) {
      for (const practicalCount of [0, 1, 2, 5, 6, 99]) {
        const state = computeSkillState("ai", input({ xp, practicalCount }));
        expect(state.level).toBeGreaterThanOrEqual(0);
        expect(state.level).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe("computeAllSkillStates", () => {
  it("returns every branch, defaulting untouched ones to Untrained", () => {
    const states = computeAllSkillStates({ web: input({ xp: 400, practicalCount: 2 }) });

    expect(states.web.level).toBe(2);
    expect(states.voice.level).toBe(0);
    expect(Object.keys(states)).toHaveLength(12);
  });
});

describe("isTechnicallyClientReady", () => {
  it("requires web, crm, automation and security all at level 3", () => {
    const ready = computeAllSkillStates({
      web: input({ xp: 700, practicalCount: 2 }),
      crm: input({ xp: 700, practicalCount: 2 }),
      automation: input({ xp: 700, practicalCount: 2 }),
      security: input({ xp: 700, practicalCount: 2 }),
    });
    expect(isTechnicallyClientReady(ready)).toBe(true);

    const missingSecurity = computeAllSkillStates({
      web: input({ xp: 700, practicalCount: 2 }),
      crm: input({ xp: 700, practicalCount: 2 }),
      automation: input({ xp: 700, practicalCount: 2 }),
      security: input({ xp: 700, practicalCount: 1 }),
    });
    expect(isTechnicallyClientReady(missingSecurity)).toBe(false);
  });
});

describe("weakestSkills", () => {
  it("surfaces started-but-lagging branches, lowest level first", () => {
    const states = computeAllSkillStates({
      web: input({ xp: 800, practicalCount: 3 }),
      crm: input({ xp: 120, practicalCount: 0 }),
      api: input({ xp: 40, practicalCount: 0 }),
    });

    const weak = weakestSkills(states, { limit: 2 });

    expect(weak.map((s) => s.key)).toEqual(["api", "crm"]);
  });
});
