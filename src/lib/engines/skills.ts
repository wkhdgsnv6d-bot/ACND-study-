import {
  SKILL_KEYS,
  SKILL_LEVEL_NAMES,
  type SkillKey,
  type SkillLevel,
} from "@/lib/domain/skills";

/**
 * Skill engine.
 *
 * The central rule of the platform lives here: a skill level is the *minimum*
 * of what you have studied and what you have proven. Reading every lesson in a
 * branch caps that branch at level 2 (Practised). Levels 3+ require approved
 * practical evidence; level 5 additionally requires a client-ready project and
 * the branch's certification.
 *
 * This is what stops "I completed the course" from meaning anything less than
 * "I can do this on a paying client's system".
 */

/** Cumulative branch XP required to reach each level, ignoring evidence. */
export const SKILL_XP_THRESHOLDS: Record<SkillLevel, number> = {
  0: 0,
  1: 100,
  2: 300,
  3: 700,
  4: 1400,
  5: 2600,
};

/** Approved practical items required to reach each level, ignoring XP. */
export const SKILL_EVIDENCE_THRESHOLDS: Record<SkillLevel, number> = {
  0: 0,
  1: 0,
  2: 0,
  3: 2,
  4: 4,
  5: 6,
};

export interface SkillEvidenceInput {
  /** Cumulative XP attributed to this branch from the XP ledger. */
  xp: number;
  /**
   * Count of *approved* practical items tagged to this branch: solved labs,
   * approved assignments, approved practical tasks and submitted projects.
   */
  practicalCount: number;
  /** At least one project tagged to this branch marked client-ready. */
  hasClientReadyProject: boolean;
  /** The branch's own certification has been earned. */
  hasCertification: boolean;
}

export type SkillCap = "xp" | "evidence" | "client-ready-project" | "certification" | null;

export interface SkillState {
  key: SkillKey;
  level: SkillLevel;
  levelName: string;
  xp: number;
  practicalCount: number;
  /** What the level would be on XP alone. */
  xpLevel: SkillLevel;
  /** What the level would be on evidence alone. */
  evidenceLevel: SkillLevel;
  /** Which constraint is currently holding the level down, if any. */
  cappedBy: SkillCap;
  /** Human-readable explanation shown on the skill tree. */
  capReason: string | null;
  /** What it takes to reach the next level. Null at level 5. */
  nextLevel: {
    level: SkillLevel;
    xpNeeded: number;
    practicalsNeeded: number;
    needsClientReadyProject: boolean;
    needsCertification: boolean;
  } | null;
}

const LEVELS: SkillLevel[] = [0, 1, 2, 3, 4, 5];

function levelFromThresholds(
  value: number,
  thresholds: Record<SkillLevel, number>,
): SkillLevel {
  let result: SkillLevel = 0;
  for (const level of LEVELS) {
    if (value >= thresholds[level]) result = level;
  }
  return result;
}

export function computeSkillState(
  key: SkillKey,
  input: SkillEvidenceInput,
): SkillState {
  const xpLevel = levelFromThresholds(input.xp, SKILL_XP_THRESHOLDS);
  const evidenceLevel = levelFromThresholds(
    input.practicalCount,
    SKILL_EVIDENCE_THRESHOLDS,
  );

  let level = Math.min(xpLevel, evidenceLevel) as SkillLevel;

  // Level 5 carries two extra gates beyond raw counts.
  let cappedBy: SkillCap = null;
  if (level === 5 && !input.hasClientReadyProject) {
    level = 4;
    cappedBy = "client-ready-project";
  } else if (level === 5 && !input.hasCertification) {
    level = 4;
    cappedBy = "certification";
  } else if (xpLevel < evidenceLevel) {
    cappedBy = "xp";
  } else if (evidenceLevel < xpLevel) {
    cappedBy = "evidence";
  }

  return {
    key,
    level,
    levelName: SKILL_LEVEL_NAMES[level],
    xp: input.xp,
    practicalCount: input.practicalCount,
    xpLevel,
    evidenceLevel,
    cappedBy,
    capReason: describeCap(cappedBy, level, input),
    nextLevel: describeNextLevel(level, input),
  };
}

function describeCap(
  cap: SkillCap,
  level: SkillLevel,
  input: SkillEvidenceInput,
): string | null {
  switch (cap) {
    case "evidence": {
      const next = (level + 1) as SkillLevel;
      const needed = SKILL_EVIDENCE_THRESHOLDS[next] - input.practicalCount;
      return `You have the knowledge for a higher level but not the proof. ${needed} more approved practical${needed === 1 ? "" : "s"} unlocks ${SKILL_LEVEL_NAMES[next]}.`;
    }
    case "xp": {
      const next = (level + 1) as SkillLevel;
      const needed = SKILL_XP_THRESHOLDS[next] - input.xp;
      return `You have the practical evidence but not the coverage yet. ${needed} more XP in this branch unlocks ${SKILL_LEVEL_NAMES[next]}.`;
    }
    case "client-ready-project":
      return "Mastered requires at least one project in this branch marked client-ready.";
    case "certification":
      return "Mastered requires this branch's certification.";
    default:
      return null;
  }
}

function describeNextLevel(
  level: SkillLevel,
  input: SkillEvidenceInput,
): SkillState["nextLevel"] {
  if (level >= 5) return null;
  const next = (level + 1) as SkillLevel;
  return {
    level: next,
    xpNeeded: Math.max(0, SKILL_XP_THRESHOLDS[next] - input.xp),
    practicalsNeeded: Math.max(
      0,
      SKILL_EVIDENCE_THRESHOLDS[next] - input.practicalCount,
    ),
    needsClientReadyProject: next === 5 && !input.hasClientReadyProject,
    needsCertification: next === 5 && !input.hasCertification,
  };
}

export function computeAllSkillStates(
  inputs: Partial<Record<SkillKey, SkillEvidenceInput>>,
): Record<SkillKey, SkillState> {
  return Object.fromEntries(
    SKILL_KEYS.map((key) => [
      key,
      computeSkillState(
        key,
        inputs[key] ?? {
          xp: 0,
          practicalCount: 0,
          hasClientReadyProject: false,
          hasCertification: false,
        },
      ),
    ]),
  ) as Record<SkillKey, SkillState>;
}

/**
 * "Client ready" in the sense used by the Term 1 milestone: the three core
 * technical disciplines plus risk & reliability all at level 3 or above.
 */
export const CLIENT_READY_SKILLS: SkillKey[] = [
  "web",
  "crm",
  "automation",
  "security",
];

export function isTechnicallyClientReady(
  states: Record<SkillKey, SkillState>,
): boolean {
  return CLIENT_READY_SKILLS.every((key) => states[key].level >= 3);
}

/**
 * Branches that are lagging relative to the learner's overall progress.
 * Feeds the "weak areas" panel on the dashboard and weekly review.
 */
export function weakestSkills(
  states: Record<SkillKey, SkillState>,
  options: { limit?: number; onlyStarted?: boolean } = {},
): SkillState[] {
  const { limit = 3, onlyStarted = true } = options;
  return Object.values(states)
    .filter((s) => (onlyStarted ? s.xp > 0 : true))
    .sort((a, b) => a.level - b.level || a.xp - b.xp)
    .slice(0, limit);
}
