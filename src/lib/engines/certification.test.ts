import { describe, expect, it } from "vitest";

import { CERTIFICATIONS } from "@/lib/domain/certifications";
import { SKILL_KEYS, type SkillKey } from "@/lib/domain/skills";
import {
  categoryOf,
  evaluateCertification,
  evaluateRequirement,
  type CertificationContext,
  type CertificationDefinition,
} from "@/lib/engines/certification";
import { computeAllSkillStates } from "@/lib/engines/skills";

function context(partial: Partial<CertificationContext> = {}): CertificationContext {
  return {
    completedLessons: new Set(),
    examScores: new Map(),
    solvedLabs: new Set(),
    approvedAssignments: new Set(),
    projects: [],
    skills: computeAllSkillStates({}),
    earnedCertifications: new Set(),
    milestones: new Set(),
    metrics: {
      monthlyRevenue: 0,
      mrr: 0,
      activeClients: 0,
      totalRevenue: 0,
      contractors: 0,
    },
    gradableLessonsByModule: new Map(),
    ...partial,
  };
}

const definition: CertificationDefinition = {
  key: "test-cert",
  name: "Test",
  tagline: "t",
  description: "d",
  term: 1,
  skill: "api",
  requirements: [
    { kind: "lessons-complete", modules: ["term-1/apis-and-webhooks"] },
    { kind: "labs-solved", labs: ["build-webhook-flow"] },
    { kind: "exam-passed", examId: "term-1/apis-and-webhooks", passMark: 80 },
  ],
};

describe("certification definitions", () => {
  it("never lets lesson completion alone earn a certification", () => {
    for (const cert of CERTIFICATIONS) {
      const categories = cert.requirements.map(categoryOf);
      const hasProof = categories.some(
        (c) => c === "practical" || c === "exam" || c === "business",
      );
      expect(
        hasProof,
        `${cert.key} can be earned without any practical, exam or business proof`,
      ).toBe(true);
    }
  });

  it("uses only known skill keys", () => {
    for (const cert of CERTIFICATIONS) {
      if (cert.skill) {
        expect(SKILL_KEYS).toContain(cert.skill);
      }
      for (const requirement of cert.requirements) {
        if (requirement.kind === "skill-at-least") {
          expect(SKILL_KEYS).toContain(requirement.skill);
        }
        if (requirement.kind === "project-submitted") {
          for (const skill of requirement.skills) {
            expect(SKILL_KEYS).toContain(skill as SkillKey);
          }
        }
      }
    }
  });

  it("references only certifications that exist", () => {
    const keys = new Set(CERTIFICATIONS.map((c) => c.key));
    for (const cert of CERTIFICATIONS) {
      for (const requirement of cert.requirements) {
        if (requirement.kind === "certification-earned") {
          expect(keys, `${cert.key} references a missing certification`).toContain(
            requirement.certification,
          );
        }
      }
    }
  });

  it("has unique keys", () => {
    const keys = CERTIFICATIONS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("the first-client rule", () => {
  /**
   * The spec is explicit: landing client #1 must never be gated behind the SEO
   * or AI Customer Service certifications. Those sit alongside the client
   * milestone inside `ascend-operator`, never as prerequisites of it.
   */
  it("does not require SEO or AI Customer Service before the first client", () => {
    const seo = CERTIFICATIONS.find((c) => c.key === "seo")!;
    const support = CERTIFICATIONS.find((c) => c.key === "ai-customer-service")!;

    for (const cert of [seo, support]) {
      for (const requirement of cert.requirements) {
        expect(requirement.kind).not.toBe("business-milestone");
        expect(requirement.kind).not.toBe("business-metric");
      }
    }

    // And the client milestone itself must not depend on either badge.
    const operator = CERTIFICATIONS.find((c) => c.key === "ascend-operator")!;
    const clientMilestone = operator.requirements.find(
      (r) => r.kind === "business-milestone" && r.milestone === "first-client-won",
    );
    expect(clientMilestone).toBeDefined();
  });
});

describe("evaluateRequirement", () => {
  it("reports partial progress on lesson completion", () => {
    const result = evaluateRequirement(
      { kind: "lessons-complete", modules: ["m"] },
      context({
        gradableLessonsByModule: new Map([["m", ["a", "b", "c", "d"]]]),
        completedLessons: new Set(["a", "b"]),
      }),
    );

    expect(result.met).toBe(false);
    expect(result.progress).toBe(0.5);
    expect(result.detail).toBe("2 of 4 lessons complete.");
  });

  it("does not consider an empty module satisfied", () => {
    const result = evaluateRequirement(
      { kind: "lessons-complete", modules: ["m"] },
      context({ gradableLessonsByModule: new Map([["m", []]]) }),
    );

    expect(result.met).toBe(false);
    expect(result.detail).toContain("No published lessons");
  });

  it("rejects a project that is missing required evidence", () => {
    const withoutLiveUrl = evaluateRequirement(
      {
        kind: "project-submitted",
        skills: ["web"],
        requiresEvidence: ["repo-url", "live-url"],
      },
      context({
        projects: [
          {
            id: "p1",
            skills: ["web"],
            evidence: { repoUrl: "https://github.com/x/y", screenshots: [] },
            clientReady: false,
            portfolioReady: false,
          },
        ],
      }),
    );

    expect(withoutLiveUrl.met).toBe(false);
    expect(withoutLiveUrl.detail).toContain("evidence links are required");
  });

  it("accepts a project once every evidence kind is present", () => {
    const result = evaluateRequirement(
      {
        kind: "project-submitted",
        skills: ["web"],
        requiresEvidence: ["repo-url", "live-url"],
      },
      context({
        projects: [
          {
            id: "p1",
            skills: ["web"],
            evidence: {
              repoUrl: "https://github.com/x/y",
              liveUrl: "https://example.com",
              screenshots: [],
            },
            clientReady: true,
            portfolioReady: true,
          },
        ],
      }),
    );

    expect(result.met).toBe(true);
  });

  it("treats a too-short write-up as absent", () => {
    const result = evaluateRequirement(
      { kind: "project-submitted", skills: ["ai"], requiresEvidence: ["written"] },
      context({
        projects: [
          {
            id: "p1",
            skills: ["ai"],
            evidence: { screenshots: [], writeUp: "done" },
            clientReady: false,
            portfolioReady: false,
          },
        ],
      }),
    );

    expect(result.met).toBe(false);
  });

  it("scores business metrics against their threshold", () => {
    const result = evaluateRequirement(
      { kind: "business-metric", metric: "mrr", min: 1000, label: "Reach $1,000 MRR" },
      context({
        metrics: {
          monthlyRevenue: 0,
          mrr: 250,
          activeClients: 0,
          totalRevenue: 0,
          contractors: 0,
        },
      }),
    );

    expect(result.met).toBe(false);
    expect(result.progress).toBe(0.25);
  });
});

describe("evaluateCertification", () => {
  it("is not-started when nothing has been touched", () => {
    const result = evaluateCertification(
      definition,
      context({
        gradableLessonsByModule: new Map([["term-1/apis-and-webhooks", ["a", "b"]]]),
      }),
    );

    expect(result.status).toBe("not-started");
    expect(result.progress).toBe(0);
    expect(result.nextAction).toContain("Complete all lessons");
  });

  it("moves to learning once lessons are underway", () => {
    const result = evaluateCertification(
      definition,
      context({
        gradableLessonsByModule: new Map([["term-1/apis-and-webhooks", ["a", "b"]]]),
        completedLessons: new Set(["a"]),
      }),
    );

    expect(result.status).toBe("learning");
  });

  it("moves to practical-required when the knowledge is done but nothing is proven", () => {
    const result = evaluateCertification(
      definition,
      context({
        gradableLessonsByModule: new Map([["term-1/apis-and-webhooks", ["a", "b"]]]),
        completedLessons: new Set(["a", "b"]),
      }),
    );

    expect(result.status).toBe("practical-required");
  });

  it("moves to exam-required once the practical work is done", () => {
    const result = evaluateCertification(
      definition,
      context({
        gradableLessonsByModule: new Map([["term-1/apis-and-webhooks", ["a", "b"]]]),
        completedLessons: new Set(["a", "b"]),
        solvedLabs: new Set(["build-webhook-flow"]),
      }),
    );

    expect(result.status).toBe("exam-required");
  });

  it("passes only when every requirement is met", () => {
    const result = evaluateCertification(
      definition,
      context({
        gradableLessonsByModule: new Map([["term-1/apis-and-webhooks", ["a", "b"]]]),
        completedLessons: new Set(["a", "b"]),
        solvedLabs: new Set(["build-webhook-flow"]),
        examScores: new Map([["term-1/apis-and-webhooks", 84]]),
      }),
    );

    expect(result.status).toBe("passed");
    expect(result.progress).toBe(1);
    expect(result.nextAction).toBeNull();
  });

  it("reports needs-improvement ahead of everything else", () => {
    const result = evaluateCertification(
      definition,
      context({
        needsImprovement: new Set(["test-cert"]),
        gradableLessonsByModule: new Map([["term-1/apis-and-webhooks", ["a"]]]),
        completedLessons: new Set(["a"]),
      }),
    );

    expect(result.status).toBe("needs-improvement");
  });
});
