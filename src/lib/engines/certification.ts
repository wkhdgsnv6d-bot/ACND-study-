import type { SkillKey, SkillLevel } from "@/lib/domain/skills";
import type { SkillState } from "@/lib/engines/skills";

/**
 * Certification engine.
 *
 * Certifications are defined declaratively as a list of typed requirements and
 * evaluated against your actual data. There is no "mark as certified" path —
 * a certification exists only as the output of this function, so it is
 * structurally impossible to earn one by completing lessons alone.
 *
 * Honest limitation: with no external examiner, practical evidence is
 * self-attested. What the engine guarantees is that bypassing a requirement is
 * a deliberate, recorded act rather than an accident. Every evaluation stores
 * the evidence references that satisfied it.
 */

export const CERTIFICATION_STATUSES = [
  "not-started",
  "learning",
  "practical-required",
  "exam-required",
  "submitted",
  "passed",
  "needs-improvement",
  "certified",
] as const;

export type CertificationStatus = (typeof CERTIFICATION_STATUSES)[number];

export const CERTIFICATION_STATUS_LABELS: Record<CertificationStatus, string> = {
  "not-started": "Not Started",
  learning: "Learning",
  "practical-required": "Practical Required",
  "exam-required": "Exam Required",
  submitted: "Submitted",
  passed: "Passed",
  "needs-improvement": "Needs Improvement",
  certified: "Certified",
};

/** Which phase of Learn → Build → Test → Apply → Prove a requirement belongs to. */
export type RequirementCategory = "knowledge" | "practical" | "exam" | "business";

export type Requirement =
  | {
      kind: "lessons-complete";
      /** Module paths, e.g. `term-1/apis-and-webhooks`. */
      modules: string[];
      /** Fraction of the module's complete-status lessons required. Default 1. */
      fraction?: number;
    }
  | { kind: "exam-passed"; examId: string; passMark: number }
  | { kind: "labs-solved"; labs: string[] }
  | { kind: "assignments-approved"; assignments: string[] }
  | {
      kind: "project-submitted";
      /** Project must be tagged with at least one of these skills. */
      skills: SkillKey[];
      requiresEvidence: Array<"repo-url" | "live-url" | "screenshot" | "written">;
      minCount?: number;
    }
  | { kind: "skill-at-least"; skill: SkillKey; level: SkillLevel }
  | { kind: "certification-earned"; certification: string }
  | { kind: "business-milestone"; milestone: string; label: string }
  | {
      kind: "business-metric";
      metric: "monthlyRevenue" | "mrr" | "activeClients" | "totalRevenue" | "contractors";
      min: number;
      label: string;
    };

export interface CertificationDefinition {
  key: string;
  name: string;
  /** The badge line the learner is working toward. */
  tagline: string;
  description: string;
  term: 1 | 2 | 3 | 4;
  /** Branch this certification proves, if it maps to exactly one. */
  skill: SkillKey | null;
  /** Ordered — the UI renders them as the path to the badge. */
  requirements: Requirement[];
}

/* ------------------------------------------------------------------ */
/* Evaluation context                                                  */
/* ------------------------------------------------------------------ */

export interface ProjectRecord {
  id: string;
  skills: SkillKey[];
  evidence: { repoUrl?: string; liveUrl?: string; screenshots: string[]; writeUp?: string };
  clientReady: boolean;
  portfolioReady: boolean;
}

export interface BusinessMetrics {
  monthlyRevenue: number;
  mrr: number;
  activeClients: number;
  totalRevenue: number;
  contractors: number;
}

export interface CertificationContext {
  completedLessons: ReadonlySet<string>;
  /** examId → best score achieved. */
  examScores: ReadonlyMap<string, number>;
  solvedLabs: ReadonlySet<string>;
  approvedAssignments: ReadonlySet<string>;
  projects: readonly ProjectRecord[];
  skills: Readonly<Record<SkillKey, SkillState>>;
  earnedCertifications: ReadonlySet<string>;
  milestones: ReadonlySet<string>;
  metrics: BusinessMetrics;
  /**
   * Module path → lesson paths that count toward completion. Only lessons with
   * `status: complete` are included, so draft content never blocks a badge.
   */
  gradableLessonsByModule: ReadonlyMap<string, readonly string[]>;
  /** Set when a submitted certification was reviewed and sent back. */
  needsImprovement?: ReadonlySet<string>;
}

export interface RequirementResult {
  requirement: Requirement;
  category: RequirementCategory;
  label: string;
  met: boolean;
  /** 0–1, for partially satisfiable requirements like "complete 12 lessons". */
  progress: number;
  detail: string;
}

export interface CertificationResult {
  key: string;
  definition: CertificationDefinition;
  status: CertificationStatus;
  requirements: RequirementResult[];
  /** 0–1 across all requirements, weighted equally. */
  progress: number;
  /** The single next thing to do. Drives "Current Objectives" on the dashboard. */
  nextAction: string | null;
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

export function categoryOf(requirement: Requirement): RequirementCategory {
  switch (requirement.kind) {
    case "lessons-complete":
      return "knowledge";
    case "exam-passed":
      return "exam";
    case "labs-solved":
    case "assignments-approved":
    case "project-submitted":
    case "skill-at-least":
      return "practical";
    case "certification-earned":
      return "knowledge";
    case "business-milestone":
    case "business-metric":
      return "business";
  }
}

export function evaluateRequirement(
  requirement: Requirement,
  ctx: CertificationContext,
): RequirementResult {
  const category = categoryOf(requirement);

  switch (requirement.kind) {
    case "lessons-complete": {
      const required = requirement.modules.flatMap(
        (m) => ctx.gradableLessonsByModule.get(m) ?? [],
      );
      const fraction = requirement.fraction ?? 1;
      const target = Math.ceil(required.length * fraction);
      const done = required.filter((l) => ctx.completedLessons.has(l)).length;
      return {
        requirement,
        category,
        label:
          fraction === 1
            ? `Complete all lessons in ${requirement.modules.length} module${requirement.modules.length === 1 ? "" : "s"}`
            : `Complete ${Math.round(fraction * 100)}% of lessons in ${requirement.modules.length} module${requirement.modules.length === 1 ? "" : "s"}`,
        met: required.length > 0 && done >= target,
        progress: target === 0 ? 0 : Math.min(1, done / target),
        detail:
          required.length === 0
            ? "No published lessons in these modules yet."
            : `${done} of ${target} lessons complete.`,
      };
    }

    case "exam-passed": {
      const best = ctx.examScores.get(requirement.examId) ?? 0;
      return {
        requirement,
        category,
        label: `Pass the module exam (${requirement.passMark}%)`,
        met: best >= requirement.passMark,
        progress: Math.min(1, best / requirement.passMark),
        detail:
          best === 0
            ? "Not attempted."
            : `Best score ${best}%, need ${requirement.passMark}%.`,
      };
    }

    case "labs-solved": {
      const done = requirement.labs.filter((l) => ctx.solvedLabs.has(l)).length;
      return {
        requirement,
        category,
        label: `Solve ${requirement.labs.length} practical lab${requirement.labs.length === 1 ? "" : "s"}`,
        met: done === requirement.labs.length,
        progress: requirement.labs.length === 0 ? 1 : done / requirement.labs.length,
        detail: `${done} of ${requirement.labs.length} labs solved.`,
      };
    }

    case "assignments-approved": {
      const done = requirement.assignments.filter((a) =>
        ctx.approvedAssignments.has(a),
      ).length;
      return {
        requirement,
        category,
        label: `Complete ${requirement.assignments.length} assignment${requirement.assignments.length === 1 ? "" : "s"}`,
        met: done === requirement.assignments.length,
        progress:
          requirement.assignments.length === 0
            ? 1
            : done / requirement.assignments.length,
        detail: `${done} of ${requirement.assignments.length} approved.`,
      };
    }

    case "project-submitted": {
      const minCount = requirement.minCount ?? 1;
      const matching = ctx.projects.filter(
        (p) =>
          p.skills.some((s) => requirement.skills.includes(s)) &&
          hasRequiredEvidence(p, requirement.requiresEvidence),
      );
      return {
        requirement,
        category,
        label: `Submit ${minCount} project${minCount === 1 ? "" : "s"} with ${requirement.requiresEvidence.join(" + ")}`,
        met: matching.length >= minCount,
        progress: Math.min(1, matching.length / minCount),
        detail:
          matching.length === 0
            ? "No qualifying project yet — evidence links are required, not optional."
            : `${matching.length} qualifying project${matching.length === 1 ? "" : "s"}.`,
      };
    }

    case "skill-at-least": {
      const state = ctx.skills[requirement.skill];
      const current = state?.level ?? 0;
      return {
        requirement,
        category,
        label: `${requirement.skill} skill at level ${requirement.level}`,
        met: current >= requirement.level,
        progress: Math.min(1, current / requirement.level),
        detail: state?.capReason ?? `Currently level ${current}.`,
      };
    }

    case "certification-earned": {
      const met = ctx.earnedCertifications.has(requirement.certification);
      return {
        requirement,
        category,
        label: `Earn the ${requirement.certification} certification`,
        met,
        progress: met ? 1 : 0,
        detail: met ? "Earned." : "Not yet earned.",
      };
    }

    case "business-milestone": {
      const met = ctx.milestones.has(requirement.milestone);
      return {
        requirement,
        category,
        label: requirement.label,
        met,
        progress: met ? 1 : 0,
        detail: met ? "Recorded." : "Not recorded yet.",
      };
    }

    case "business-metric": {
      const current = ctx.metrics[requirement.metric];
      return {
        requirement,
        category,
        label: requirement.label,
        met: current >= requirement.min,
        progress: requirement.min === 0 ? 1 : Math.min(1, current / requirement.min),
        detail: `Currently ${current}, need ${requirement.min}.`,
      };
    }
  }
}

function hasRequiredEvidence(
  project: ProjectRecord,
  required: Array<"repo-url" | "live-url" | "screenshot" | "written">,
): boolean {
  return required.every((kind) => {
    switch (kind) {
      case "repo-url":
        return Boolean(project.evidence.repoUrl);
      case "live-url":
        return Boolean(project.evidence.liveUrl);
      case "screenshot":
        return project.evidence.screenshots.length > 0;
      case "written":
        return Boolean(project.evidence.writeUp && project.evidence.writeUp.length > 50);
    }
  });
}

export function evaluateCertification(
  definition: CertificationDefinition,
  ctx: CertificationContext,
): CertificationResult {
  const requirements = definition.requirements.map((r) =>
    evaluateRequirement(r, ctx),
  );

  const progress =
    requirements.length === 0
      ? 0
      : requirements.reduce((sum, r) => sum + r.progress, 0) / requirements.length;

  const status = deriveStatus(definition, requirements, ctx);
  const nextAction = requirements.find((r) => !r.met) ?? null;

  return {
    key: definition.key,
    definition,
    status,
    requirements,
    progress,
    nextAction: nextAction ? `${nextAction.label} — ${nextAction.detail}` : null,
  };
}

function deriveStatus(
  definition: CertificationDefinition,
  requirements: RequirementResult[],
  ctx: CertificationContext,
): CertificationStatus {
  if (ctx.earnedCertifications.has(definition.key)) return "certified";
  if (ctx.needsImprovement?.has(definition.key)) return "needs-improvement";

  const allMet = requirements.every((r) => r.met);
  if (allMet) return "passed";

  const untouched = requirements.every((r) => r.progress === 0);
  if (untouched) return "not-started";

  const byCategory = (category: RequirementCategory) =>
    requirements.filter((r) => r.category === category);

  const knowledgeMet = byCategory("knowledge").every((r) => r.met);
  const practicalMet = byCategory("practical").every((r) => r.met);
  const examMet = byCategory("exam").every((r) => r.met);

  if (!knowledgeMet) return "learning";
  if (!practicalMet) return "practical-required";
  if (!examMet) return "exam-required";
  return "submitted";
}

export function evaluateAll(
  definitions: readonly CertificationDefinition[],
  ctx: CertificationContext,
): CertificationResult[] {
  return definitions.map((d) => evaluateCertification(d, ctx));
}
