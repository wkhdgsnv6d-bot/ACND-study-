import { describe, expect, it } from "vitest";

import { LABS, LABS_BY_ID, type LabDefinition } from "@/lib/domain/labs";
import { SKILL_KEYS } from "@/lib/domain/skills";
import { gradeLab, labItemCount } from "@/lib/engines/labs";

/** Answers that solve a lab completely, derived from its definition. */
function solution(lab: LabDefinition): Record<string, string | string[]> {
  switch (lab.kind) {
    case "fix-config":
    case "mapping":
      return Object.fromEntries(lab.fields.map((f) => [f.id, f.accept[0]!]));
    case "classify":
      return Object.fromEntries(lab.items.map((i) => [i.id, i.correctCategory]));
    case "ordering":
      return Object.fromEntries(lab.steps.map((s) => [s.id, String(s.position)]));
    case "spot-the-flaw":
      return { selected: lab.flaws.map((f) => String(f.line)) };
  }
}

describe("lab definitions", () => {
  it("have unique ids", () => {
    const ids = LABS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reference only known skills", () => {
    for (const lab of LABS) {
      for (const skill of lab.skills) expect(SKILL_KEYS).toContain(skill);
      for (const key of Object.keys(lab.skillXp)) expect(SKILL_KEYS).toContain(key);
    }
  });

  it("state the mistake they exist to prevent", () => {
    for (const lab of LABS) {
      expect(lab.inoculatesAgainst.length, `${lab.id} has no rationale`).toBeGreaterThan(
        40,
      );
    }
  });

  it("explain every item, not just the answer", () => {
    for (const lab of LABS) {
      const explanations =
        lab.kind === "fix-config" || lab.kind === "mapping"
          ? lab.fields.map((f) => f.explanation)
          : lab.kind === "classify"
            ? lab.items.map((i) => i.explanation)
            : lab.kind === "ordering"
              ? lab.steps.map((s) => s.explanation)
              : lab.flaws.map((f) => f.explanation);

      for (const explanation of explanations) {
        expect(explanation.length, `${lab.id} has a thin explanation`).toBeGreaterThan(
          40,
        );
      }
    }
  });

  it("give ordering labs a contiguous 1..n sequence", () => {
    for (const lab of LABS) {
      if (lab.kind !== "ordering") continue;
      const positions = lab.steps.map((s) => s.position).sort((a, b) => a - b);
      expect(positions).toEqual(lab.steps.map((_, i) => i + 1));
    }
  });

  it("keep spot-the-flaw line numbers inside the code block", () => {
    for (const lab of LABS) {
      if (lab.kind !== "spot-the-flaw") continue;
      const lines = lab.code.split("\n").length;
      for (const flaw of lab.flaws) {
        expect(flaw.line, `${lab.id} flaw ${flaw.id} is out of range`).toBeLessThanOrEqual(
          lines,
        );
        expect(flaw.line).toBeGreaterThan(0);
      }
    }
  });

  it("assign every classify item to a category that exists", () => {
    for (const lab of LABS) {
      if (lab.kind !== "classify") continue;
      const ids = new Set(lab.categories.map((c) => c.id));
      for (const item of lab.items) expect(ids).toContain(item.correctCategory);
    }
  });
});

describe("gradeLab", () => {
  it.each(LABS.map((l) => [l.id, l] as const))(
    "%s is solvable with its own answers",
    (_id, lab) => {
      const result = gradeLab(lab, solution(lab));
      expect(result.solved).toBe(true);
      expect(result.correctCount).toBe(labItemCount(lab));
    },
  );

  it.each(LABS.map((l) => [l.id, l] as const))(
    "%s is not solved by an empty submission",
    (_id, lab) => {
      expect(gradeLab(lab, {}).solved).toBe(false);
    },
  );

  it("accepts a right answer in any casing or spacing", () => {
    const lab = LABS_BY_ID.get("fix-broken-dns")!;
    const result = gradeLab(lab, {
      "root-record-type": "  a  ",
      "missing-mx": "mx",
      "spf-policy": "~all",
    });

    expect(result.solved).toBe(true);
  });

  it("accepts a longer but equivalent JSON path", () => {
    const lab = LABS_BY_ID.get("map-json-payload")!;
    const result = gradeLab(lab, {
      email: "$.contact.email",
      "full-name": "contact.first_name",
      attachment: "attachments[0].url",
      "lead-source": "utm.source",
    });

    expect(result.solved).toBe(true);
  });

  it("penalises flagging clean lines in a review lab", () => {
    const lab = LABS_BY_ID.get("identify-exposed-api-key")!;
    if (lab.kind !== "spot-the-flaw") throw new Error("wrong kind");

    const everything = gradeLab(lab, {
      selected: Array.from({ length: lab.lineCount }, (_, i) => String(i + 1)),
    });

    expect(everything.solved).toBe(false);
    expect(
      everything.results.some((r) => r.id.startsWith("false-positive")),
    ).toBe(true);
  });

  it("returns an explanation for every item, right or wrong", () => {
    const lab = LABS_BY_ID.get("debug-api-response")!;
    const result = gradeLab(lab, { "401": "credentials" });

    expect(result.results).toHaveLength(labItemCount(lab));
    for (const item of result.results) {
      expect(item.explanation.length).toBeGreaterThan(0);
    }
  });
});
