import type { SupabaseClient, User } from "@supabase/supabase-js";

import { loadCurriculum } from "@/lib/content/loader";
import { CERTIFICATIONS } from "@/lib/domain/certifications";
import { SKILL_KEYS, type SkillKey } from "@/lib/domain/skills";
import {
  evaluateAll,
  type BusinessMetrics,
  type CertificationContext,
  type CertificationResult,
  type ProjectRecord,
} from "@/lib/engines/certification";
import { computeAllSkillStates, type SkillState } from "@/lib/engines/skills";
import {
  computeStreak,
  toDayKey,
  type StreakState,
  type StudyDay,
} from "@/lib/engines/streak";
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
 * Dashboard data.
 *
 * Reads raw rows through the RLS-enforced Supabase client, then hands them to
 * the pure engines. Nothing here decides anything — every level, badge, streak
 * and lock is computed by the same tested functions the rest of the platform
 * uses, so the dashboard cannot drift from the rules it displays.
 *
 * A brand-new account legitimately produces zeros. That is shown honestly as
 * empty state rather than filled with sample data.
 */

export interface DashboardData {
  xp: XpTotals;
  level: LevelProgress;
  skills: Record<SkillKey, SkillState>;
  streak: StreakState;
  certifications: CertificationResult[];
  metrics: BusinessMetrics;
  term4: Term4UnlockState;
  lessonsCompleted: number;
  /** Lessons with `status: complete` across the whole curriculum. */
  lessonsAvailable: number;
  submissionsApproved: number;
  labsSolved: number;
  projectCount: number;
  prospectsContacted: number;
  clientsWon: number;
  minutesStudiedThisWeek: number;
  timeZone: string;
  /** Set when a query failed, so the UI can say so instead of showing zeros. */
  error: string | null;
}

export async function getDashboardData(user: User): Promise<DashboardData> {
  const supabase = await createClient();
  if (!supabase) return emptyDashboard("Database not configured.");

  try {
    return await loadDashboard(supabase, user);
  } catch (error) {
    // Most likely cause: migrations have not been run against the project yet.
    const message =
      error instanceof Error ? error.message : "Could not load your data.";
    return emptyDashboard(message);
  }
}

async function loadDashboard(
  supabase: SupabaseClient,
  user: User,
): Promise<DashboardData> {
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
    prospectResult,
  ] = await Promise.all([
    supabase.from("profiles").select("time_zone").eq("id", user.id).maybeSingle(),
    supabase.from("settings").select("term4_unlock").eq("user_id", user.id).maybeSingle(),
    supabase.from("xp_events").select("id, source_type, source_id, amount, skill_xp, awarded_at"),
    supabase.from("lesson_progress").select("lesson_path, status"),
    supabase.from("study_sessions").select("local_day, seconds"),
    supabase.from("submissions").select("kind, ref, status"),
    supabase.from("lab_attempts").select("lab_id, solved"),
    supabase.from("projects").select("id, skills, repo_url, live_url, screenshots, lessons_learned, client_ready, portfolio_ready"),
    supabase.from("certifications").select("cert_key, status"),
    supabase.from("business_milestones").select("key"),
    supabase.from("revenue_entries").select("amount_cents, type, incurred_on"),
    supabase.from("clients").select("id, status, mrr_cents"),
    supabase.from("prospects").select("id, stage"),
  ]);

  const firstError = [
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
    prospectResult,
  ].find((r) => r.error)?.error;

  if (firstError) throw new Error(firstError.message);

  const timeZone =
    (profileResult.data as { time_zone?: string } | null)?.time_zone ??
    "Australia/Sydney";
  const today = toDayKey(new Date(), timeZone);

  /* --- XP and levels ---------------------------------------------- */

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
  const level = levelFromXp(xp.total);
  const branchXp = skillXpTotals(xpEvents);

  /* --- Practical evidence per branch ------------------------------- */

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

  const approvedSubmissions = (submissionResult.data ?? []).filter(
    (row) => (row as { status: string }).status === "approved",
  );
  const solvedLabs = new Set(
    (labResult.data ?? [])
      .filter((row) => (row as { solved: boolean }).solved)
      .map((row) => (row as { lab_id: string }).lab_id),
  );

  const earnedCertifications = new Set(
    (certResult.data ?? [])
      .filter((row) => (row as { status: string }).status === "certified")
      .map((row) => (row as { cert_key: string }).cert_key),
  );

  const skills = computeAllSkillStates(
    Object.fromEntries(
      SKILL_KEYS.map((key) => {
        const projectsForSkill = projects.filter((p) => p.skills.includes(key));
        return [
          key,
          {
            xp: branchXp[key] ?? 0,
            practicalCount: practicalEvidenceCount(key, {
              approvedSubmissionCount: approvedSubmissions.length,
              solvedLabCount: solvedLabs.size,
              projectCount: projectsForSkill.length,
            }),
            hasClientReadyProject: projectsForSkill.some((p) => p.clientReady),
            hasCertification: earnedCertifications.has(
              CERTIFICATIONS.find((c) => c.skill === key)?.key ?? "",
            ),
          },
        ];
      }),
    ),
  );

  /* --- Streak ------------------------------------------------------ */

  const studyDays: StudyDay[] = (sessionResult.data ?? []).map((row) => {
    const r = row as { local_day: string; seconds: number };
    return { day: r.local_day, minutes: Math.round(r.seconds / 60) };
  });
  const streak = computeStreak(studyDays, today);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartKey = toDayKey(weekStart, timeZone);
  const minutesStudiedThisWeek = studyDays
    .filter((d) => d.day >= weekStartKey && d.day <= today)
    .reduce((sum, d) => sum + d.minutes, 0);

  /* --- Business metrics -------------------------------------------- */

  const revenueRows = (revenueResult.data ?? []) as Array<{
    amount_cents: number;
    type: string;
    incurred_on: string;
  }>;
  const clientRows = (clientResult.data ?? []) as Array<{
    id: string;
    status: string;
    mrr_cents: number;
  }>;
  const prospectRows = (prospectResult.data ?? []) as Array<{
    id: string;
    stage: string;
  }>;

  const monthStart = today.slice(0, 8) + "01";
  const metrics: BusinessMetrics = {
    monthlyRevenue: centsToDollarsRounded(
      revenueRows
        .filter((r) => r.incurred_on >= monthStart)
        .reduce((sum, r) => sum + r.amount_cents, 0),
    ),
    mrr: centsToDollarsRounded(
      clientRows
        .filter((c) => c.status === "active")
        .reduce((sum, c) => sum + c.mrr_cents, 0),
    ),
    activeClients: clientRows.filter((c) => c.status === "active").length,
    totalRevenue: centsToDollarsRounded(
      revenueRows.reduce((sum, r) => sum + r.amount_cents, 0),
    ),
    // Recorded as a milestone until Phase 3 of the business layer models
    // contractors explicitly.
    contractors: (milestoneResult.data ?? []).some(
      (row) => (row as { key: string }).key === "first-contractor",
    )
      ? 1
      : 0,
  };

  /* --- Certifications and locks ------------------------------------ */

  const { curriculum } = loadCurriculum();
  const gradableLessonsByModule = new Map<string, string[]>();
  for (const mod of curriculum.modulesByPath.values()) {
    gradableLessonsByModule.set(
      mod.path,
      mod.lessons
        .filter((l) => l.frontmatter.status === "complete")
        .map((l) => l.path),
    );
  }

  const completedLessons = new Set(
    (lessonResult.data ?? [])
      .filter((row) => (row as { status: string }).status === "completed")
      .map((row) => (row as { lesson_path: string }).lesson_path),
  );

  const context: CertificationContext = {
    completedLessons,
    examScores: new Map(),
    solvedLabs,
    approvedAssignments: new Set(
      approvedSubmissions.map((row) => (row as { ref: string }).ref),
    ),
    projects,
    skills,
    earnedCertifications,
    milestones: new Set(
      (milestoneResult.data ?? []).map((row) => (row as { key: string }).key),
    ),
    metrics,
    gradableLessonsByModule,
  };

  const term4Config = mergeTerm4Config(
    (settingsResult.data as { term4_unlock?: unknown } | null)?.term4_unlock,
  );

  return {
    xp,
    level,
    skills,
    streak,
    certifications: evaluateAll(CERTIFICATIONS, context),
    metrics,
    term4: evaluateTerm4Unlock(term4Config, metrics),
    lessonsCompleted: completedLessons.size,
    lessonsAvailable: [...curriculum.lessonsByPath.values()].filter(
      (l) => l.frontmatter.status === "complete",
    ).length,
    submissionsApproved: approvedSubmissions.length,
    labsSolved: solvedLabs.size,
    projectCount: projects.length,
    prospectsContacted: prospectRows.filter((p) => p.stage !== "lead").length,
    clientsWon: clientRows.length,
    minutesStudiedThisWeek,
    timeZone,
    error: null,
  };
}

/**
 * Per-branch practical evidence.
 *
 * Phase 2 has no lesson or lab UI yet, so nothing tags evidence to a branch —
 * every count is legitimately zero. Phase 3 replaces this with the real
 * per-skill attribution stored on each submission and lab attempt; the shape is
 * settled now so the skill engine has its true input from the start.
 */
function practicalEvidenceCount(
  _skill: SkillKey,
  counts: {
    approvedSubmissionCount: number;
    solvedLabCount: number;
    projectCount: number;
  },
): number {
  return counts.projectCount;
}

function mergeTerm4Config(stored: unknown): Term4UnlockConfig {
  if (!stored || typeof stored !== "object") return DEFAULT_TERM_4_CONFIG;
  const partial = stored as Partial<Term4UnlockConfig>;
  return {
    ...DEFAULT_TERM_4_CONFIG,
    ...partial,
    thresholds: { ...DEFAULT_TERM_4_CONFIG.thresholds, ...partial.thresholds },
  };
}

function centsToDollarsRounded(cents: number): number {
  return Math.round(cents / 100);
}

function emptyDashboard(error: string | null): DashboardData {
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
    streak: computeStreak([], toDayKey(new Date())),
    certifications: [],
    metrics,
    term4: evaluateTerm4Unlock(DEFAULT_TERM_4_CONFIG, metrics),
    lessonsCompleted: 0,
    lessonsAvailable: [...curriculum.lessonsByPath.values()].filter(
      (l) => l.frontmatter.status === "complete",
    ).length,
    submissionsApproved: 0,
    labsSolved: 0,
    projectCount: 0,
    prospectsContacted: 0,
    clientsWon: 0,
    minutesStudiedThisWeek: 0,
    timeZone: "Australia/Sydney",
    error,
  };
}
