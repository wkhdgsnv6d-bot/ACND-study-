import type { SupabaseClient, User } from "@supabase/supabase-js";

import { loadCurriculum } from "@/lib/content/loader";
import { CERTIFICATIONS } from "@/lib/domain/certifications";
import { LABS_BY_ID } from "@/lib/domain/labs";
import { SKILL_KEYS, type SkillKey } from "@/lib/domain/skills";
import {
  evaluateAll,
  type BusinessMetrics,
  type CertificationContext,
  type CertificationResult,
  type ProjectRecord,
} from "@/lib/engines/certification";
import { computeAllSkillStates, type SkillState } from "@/lib/engines/skills";
import { computeStreak, toDayKey, type StreakState, type StudyDay } from "@/lib/engines/streak";
import {
  DEFAULT_TERM_4_CONFIG,
  evaluateTerm4Unlock,
  type Term4UnlockConfig,
  type Term4UnlockState,
} from "@/lib/engines/unlock";
import {
  levelFromXp,
  skillXpTotals,
  totalXp,
  type LevelProgress,
  type XpEvent,
  type XpSourceType,
  type XpTotals,
} from "@/lib/engines/xp";
import { createClient } from "@/lib/supabase/server";

/**
 * The single progress snapshot.
 *
 * Every surface that shows a level, a badge, a streak or a lock reads this, so
 * the dashboard, the skill tree and the certifications page cannot disagree
 * about the same account. Raw rows go in; the pure engines decide everything.
 *
 * Per-skill practical evidence is computed properly here: solved labs,
 * approved practical submissions and portfolio projects are each attributed to
 * the branches they actually advance, via the `skillXp` declared on the lab or
 * the lesson. This is the input that decides whether a branch can pass
 * Practised, so it is worth being exact about.
 */

export interface ProgressSnapshot {
  xp: XpTotals;
  level: LevelProgress;
  skills: Record<SkillKey, SkillState>;
  /** What produced each branch's evidence count, for the skill tree to explain. */
  evidence: Record<SkillKey, SkillEvidenceBreakdown>;
  streak: StreakState;
  certifications: CertificationResult[];
  earnedCertifications: Set<string>;
  metrics: BusinessMetrics;
  term4: Term4UnlockState;
  completedLessons: Set<string>;
  solvedLabs: Set<string>;
  approvedSubmissions: Set<string>;
  projects: ProjectRecord[];
  lessonsAvailable: number;
  minutesStudiedThisWeek: number;
  studyDays: StudyDay[];
  timeZone: string;
  error: string | null;
}

export interface SkillEvidenceBreakdown {
  labs: number;
  practicals: number;
  projects: number;
  total: number;
}

export async function getProgressSnapshot(user: User): Promise<ProgressSnapshot> {
  const supabase = await createClient();
  if (!supabase) return emptySnapshot("Database not configured.");

  try {
    return await load(supabase, user);
  } catch (error) {
    return emptySnapshot(
      error instanceof Error ? error.message : "Could not load your progress.",
    );
  }
}

async function load(
  supabase: SupabaseClient,
  user: User,
): Promise<ProgressSnapshot> {
  const results = await Promise.all([
    supabase.from("profiles").select("time_zone").eq("id", user.id).maybeSingle(),
    supabase.from("settings").select("term4_unlock").eq("user_id", user.id).maybeSingle(),
    supabase.from("xp_events").select("id, source_type, source_id, amount, skill_xp, awarded_at"),
    supabase.from("lesson_progress").select("lesson_path, status"),
    supabase.from("study_sessions").select("local_day, seconds"),
    supabase.from("submissions").select("kind, ref, status"),
    supabase.from("lab_attempts").select("lab_id, solved"),
    supabase
      .from("projects")
      .select("id, skills, repo_url, live_url, screenshots, lessons_learned, client_ready, portfolio_ready"),
    supabase.from("certifications").select("cert_key, status"),
    supabase.from("business_milestones").select("key"),
    supabase.from("revenue_entries").select("amount_cents, type, incurred_on"),
    supabase.from("clients").select("id, status, mrr_cents"),
    supabase.from("exam_attempts").select("exam_id, score_percent, passed"),
  ]);

  const failure = results.find((r) => r.error)?.error;
  if (failure) throw new Error(failure.message);

  const [
    profileResult,
    settingsResult,
    xpResult,
    lessonResult,
    sessionResult,
    submissionResult,
    labResult,
    projectResult,
    certResult,
    milestoneResult,
    revenueResult,
    clientResult,
    examResult,
  ] = results;

  const timeZone =
    (profileResult.data as { time_zone?: string } | null)?.time_zone ??
    "Australia/Sydney";
  const today = toDayKey(new Date(), timeZone);

  /* --- XP ---------------------------------------------------------- */

  const xpEvents: XpEvent[] = (xpResult.data ?? []).map((row) => {
    const r = row as {
      id: string;
      source_type: string;
      source_id: string;
      amount: number;
      skill_xp: Record<string, number>;
      awarded_at: string;
    };
    return {
      id: r.id,
      sourceType: r.source_type.replaceAll("_", "-") as XpSourceType,
      sourceId: r.source_id,
      amount: r.amount,
      skillXp: r.skill_xp as Partial<Record<SkillKey, number>>,
      awardedAt: new Date(r.awarded_at),
    };
  });

  const xp = totalXp(xpEvents);
  const branchXp = skillXpTotals(xpEvents);

  /* --- Evidence, attributed per branch ------------------------------ */

  const { curriculum } = loadCurriculum();

  const solvedLabs = new Set(
    (labResult.data ?? [])
      .filter((row) => (row as { solved: boolean }).solved)
      .map((row) => (row as { lab_id: string }).lab_id),
  );

  const approvedSubmissions = new Set(
    (submissionResult.data ?? [])
      .filter((row) => (row as { status: string }).status === "approved")
      .map((row) => (row as { ref: string }).ref),
  );

  const projects: ProjectRecord[] = (projectResult.data ?? []).map((row) => {
    const r = row as {
      id: string;
      skills: string[] | null;
      repo_url: string | null;
      live_url: string | null;
      screenshots: string[] | null;
      lessons_learned: string | null;
      client_ready: boolean;
      portfolio_ready: boolean;
    };
    return {
      id: r.id,
      skills: (r.skills ?? []).filter((s): s is SkillKey =>
        (SKILL_KEYS as readonly string[]).includes(s),
      ),
      evidence: {
        repoUrl: r.repo_url ?? undefined,
        liveUrl: r.live_url ?? undefined,
        screenshots: r.screenshots ?? [],
        writeUp: r.lessons_learned ?? undefined,
      },
      clientReady: r.client_ready,
      portfolioReady: r.portfolio_ready,
    };
  });

  const evidence = Object.fromEntries(
    SKILL_KEYS.map((key) => {
      const labs = [...solvedLabs].filter((id) =>
        Object.keys(LABS_BY_ID.get(id)?.skillXp ?? {}).includes(key),
      ).length;

      const practicals = [...approvedSubmissions].filter((ref) => {
        const lesson = curriculum.lessonsByPath.get(ref);
        if (!lesson) return false;
        const task = lesson.frontmatter.practicalTask;
        const skills = Object.keys(task?.skillXp ?? lesson.frontmatter.skillXp);
        return skills.includes(key);
      }).length;

      const projectCount = projects.filter((p) => p.skills.includes(key)).length;

      return [
        key,
        { labs, practicals, projects: projectCount, total: labs + practicals + projectCount },
      ];
    }),
  ) as Record<SkillKey, SkillEvidenceBreakdown>;

  const earnedCertifications = new Set(
    (certResult.data ?? [])
      .filter((row) => (row as { status: string }).status === "certified")
      .map((row) => (row as { cert_key: string }).cert_key),
  );

  const skills = computeAllSkillStates(
    Object.fromEntries(
      SKILL_KEYS.map((key) => [
        key,
        {
          xp: branchXp[key] ?? 0,
          practicalCount: evidence[key].total,
          hasClientReadyProject: projects.some(
            (p) => p.clientReady && p.skills.includes(key),
          ),
          hasCertification: earnedCertifications.has(
            CERTIFICATIONS.find((c) => c.skill === key)?.key ?? "",
          ),
        },
      ]),
    ),
  );

  /* --- Study, streak, business -------------------------------------- */

  const studyDays: StudyDay[] = (sessionResult.data ?? []).map((row) => {
    const r = row as { local_day: string; seconds: number };
    return { day: r.local_day, minutes: Math.round(r.seconds / 60) };
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartKey = toDayKey(weekStart, timeZone);

  const revenueRows = (revenueResult.data ?? []) as Array<{
    amount_cents: number;
    incurred_on: string;
  }>;
  const clientRows = (clientResult.data ?? []) as Array<{
    status: string;
    mrr_cents: number;
  }>;
  const milestones = new Set(
    (milestoneResult.data ?? []).map((row) => (row as { key: string }).key),
  );

  const monthStart = `${today.slice(0, 8)}01`;
  const metrics: BusinessMetrics = {
    monthlyRevenue: Math.round(
      revenueRows
        .filter((r) => r.incurred_on >= monthStart)
        .reduce((sum, r) => sum + r.amount_cents, 0) / 100,
    ),
    mrr: Math.round(
      clientRows
        .filter((c) => c.status === "active")
        .reduce((sum, c) => sum + c.mrr_cents, 0) / 100,
    ),
    activeClients: clientRows.filter((c) => c.status === "active").length,
    totalRevenue: Math.round(
      revenueRows.reduce((sum, r) => sum + r.amount_cents, 0) / 100,
    ),
    contractors: milestones.has("first-contractor") ? 1 : 0,
  };

  /* --- Certifications ------------------------------------------------ */

  const gradableLessonsByModule = new Map<string, string[]>();
  for (const mod of curriculum.modulesByPath.values()) {
    gradableLessonsByModule.set(
      mod.path,
      mod.lessons.filter((l) => l.frontmatter.status === "complete").map((l) => l.path),
    );
  }

  const completedLessons = new Set(
    (lessonResult.data ?? [])
      .filter((row) => (row as { status: string }).status === "completed")
      .map((row) => (row as { lesson_path: string }).lesson_path),
  );

  const examScores = new Map<string, number>();
  for (const row of examResult.data ?? []) {
    const r = row as { exam_id: string; score_percent: number | null };
    if (r.score_percent === null) continue;
    examScores.set(r.exam_id, Math.max(examScores.get(r.exam_id) ?? 0, r.score_percent));
  }

  const context: CertificationContext = {
    completedLessons,
    examScores,
    solvedLabs,
    approvedAssignments: approvedSubmissions,
    projects,
    skills,
    earnedCertifications,
    milestones,
    metrics,
    gradableLessonsByModule,
  };

  const term4Config = mergeTerm4(
    (settingsResult.data as { term4_unlock?: unknown } | null)?.term4_unlock,
  );

  return {
    xp,
    level: levelFromXp(xp.total),
    skills,
    evidence,
    streak: computeStreak(studyDays, today),
    certifications: evaluateAll(CERTIFICATIONS, context),
    earnedCertifications,
    metrics,
    term4: evaluateTerm4Unlock(term4Config, metrics),
    completedLessons,
    solvedLabs,
    approvedSubmissions,
    projects,
    lessonsAvailable: [...curriculum.lessonsByPath.values()].filter(
      (l) => l.frontmatter.status === "complete",
    ).length,
    minutesStudiedThisWeek: studyDays
      .filter((d) => d.day >= weekStartKey && d.day <= today)
      .reduce((sum, d) => sum + d.minutes, 0),
    studyDays,
    timeZone,
    error: null,
  };
}

function mergeTerm4(stored: unknown): Term4UnlockConfig {
  if (!stored || typeof stored !== "object") return DEFAULT_TERM_4_CONFIG;
  const partial = stored as Partial<Term4UnlockConfig>;
  return {
    ...DEFAULT_TERM_4_CONFIG,
    ...partial,
    thresholds: { ...DEFAULT_TERM_4_CONFIG.thresholds, ...partial.thresholds },
  };
}

function emptySnapshot(error: string): ProgressSnapshot {
  const { curriculum } = loadCurriculum();
  const metrics: BusinessMetrics = {
    monthlyRevenue: 0,
    mrr: 0,
    activeClients: 0,
    totalRevenue: 0,
    contractors: 0,
  };

  return {
    xp: totalXp([]),
    level: levelFromXp(0),
    skills: computeAllSkillStates({}),
    evidence: Object.fromEntries(
      SKILL_KEYS.map((k) => [k, { labs: 0, practicals: 0, projects: 0, total: 0 }]),
    ) as Record<SkillKey, SkillEvidenceBreakdown>,
    streak: computeStreak([], toDayKey(new Date())),
    certifications: [],
    earnedCertifications: new Set(),
    metrics,
    term4: evaluateTerm4Unlock(DEFAULT_TERM_4_CONFIG, metrics),
    completedLessons: new Set(),
    solvedLabs: new Set(),
    approvedSubmissions: new Set(),
    projects: [],
    lessonsAvailable: [...curriculum.lessonsByPath.values()].filter(
      (l) => l.frontmatter.status === "complete",
    ).length,
    minutesStudiedThisWeek: 0,
    studyDays: [],
    timeZone: "Australia/Sydney",
    error,
  };
}
