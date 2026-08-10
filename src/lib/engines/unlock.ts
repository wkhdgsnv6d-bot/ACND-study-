import type { BusinessMetrics } from "@/lib/engines/certification";

/**
 * Locking engine.
 *
 * Two kinds of lock exist, and they are deliberately different:
 *
 * - **Prerequisite locks** are pedagogical. A lesson is locked only when it
 *   genuinely builds on earlier material. They are cheap to satisfy and always
 *   explain exactly which lesson opens them.
 *
 * - **The Term 4 lock** is strategic. CEO material is not harder — it is
 *   *premature*. Learning to manage a company you do not have is the most
 *   seductive form of procrastination available to a founder, so Term 4 stays
 *   shut until the business produces evidence that the material now applies.
 */

export const TERM_4_LOCK_MESSAGE =
  "Build the machine before learning how to manage a company you don't yet have.";

export interface Term4UnlockConfig {
  /** Turning this off opens Term 4 permanently. Your platform, your call. */
  enabled: boolean;
  /**
   * `any` — one threshold is enough (the default; different businesses reach
   * CEO-level problems by different routes).
   * `all` — every configured threshold must be met.
   */
  mode: "any" | "all";
  thresholds: {
    monthlyRevenue?: number;
    mrr?: number;
    activeClients?: number;
    contractors?: number;
  };
  /** Manual unlock requires a written reason, which is stored and shown. */
  manualOverride?: { unlockedAt: Date; reason: string } | null;
}

export const DEFAULT_TERM_4_CONFIG: Term4UnlockConfig = {
  enabled: true,
  mode: "any",
  thresholds: {
    monthlyRevenue: 10_000,
    mrr: 3_000,
    activeClients: 5,
    contractors: 1,
  },
  manualOverride: null,
};

export interface ThresholdStatus {
  key: keyof Term4UnlockConfig["thresholds"];
  label: string;
  current: number;
  target: number;
  met: boolean;
  /** 0–1, clamped. Drives the progress bars on the lock screen. */
  progress: number;
  format: "currency" | "count";
}

export interface Term4UnlockState {
  unlocked: boolean;
  reason: "disabled" | "manual-override" | "thresholds-met" | "locked";
  /** Present only when unlocked via manual override. */
  overrideReason?: string;
  thresholds: ThresholdStatus[];
  message: string;
  /** The single closest threshold — what to aim at next. */
  nearest: ThresholdStatus | null;
}

const THRESHOLD_LABELS: Record<
  keyof Term4UnlockConfig["thresholds"],
  { label: string; format: "currency" | "count" }
> = {
  monthlyRevenue: { label: "Monthly revenue", format: "currency" },
  mrr: { label: "Monthly recurring revenue", format: "currency" },
  activeClients: { label: "Active clients", format: "count" },
  contractors: { label: "Regular contractors or employees", format: "count" },
};

export function evaluateTerm4Unlock(
  config: Term4UnlockConfig,
  metrics: BusinessMetrics,
): Term4UnlockState {
  const thresholds: ThresholdStatus[] = (
    Object.keys(config.thresholds) as Array<keyof Term4UnlockConfig["thresholds"]>
  )
    .filter((key) => typeof config.thresholds[key] === "number")
    .map((key) => {
      const target = config.thresholds[key]!;
      const current = metrics[key];
      const meta = THRESHOLD_LABELS[key];
      return {
        key,
        label: meta.label,
        format: meta.format,
        current,
        target,
        met: current >= target,
        progress: target === 0 ? 1 : Math.min(1, current / target),
      };
    });

  const nearest =
    thresholds.length === 0
      ? null
      : [...thresholds].sort((a, b) => b.progress - a.progress)[0]!;

  if (!config.enabled) {
    return {
      unlocked: true,
      reason: "disabled",
      thresholds,
      nearest,
      message: "Term 4 gating is switched off in Settings.",
    };
  }

  if (config.manualOverride) {
    return {
      unlocked: true,
      reason: "manual-override",
      overrideReason: config.manualOverride.reason,
      thresholds,
      nearest,
      message: `Unlocked manually: ${config.manualOverride.reason}`,
    };
  }

  const met =
    thresholds.length > 0 &&
    (config.mode === "any"
      ? thresholds.some((t) => t.met)
      : thresholds.every((t) => t.met));

  if (met) {
    return {
      unlocked: true,
      reason: "thresholds-met",
      thresholds,
      nearest,
      message:
        "Ascend has reached the point where CEO-level material earns its keep. Term 4 is open.",
    };
  }

  return {
    unlocked: false,
    reason: "locked",
    thresholds,
    nearest,
    message: TERM_4_LOCK_MESSAGE,
  };
}

/* ------------------------------------------------------------------ */
/* Prerequisite locks                                                  */
/* ------------------------------------------------------------------ */

export interface LockState {
  locked: boolean;
  /** Lesson or module paths that must be completed first. */
  blockedBy: string[];
  reason: string | null;
}

export function evaluateLessonLock(options: {
  prerequisites: readonly string[];
  completedLessons: ReadonlySet<string>;
  /** Titles for a readable message. Falls back to the path. */
  titleFor?: (path: string) => string;
}): LockState {
  const missing = options.prerequisites.filter(
    (p) => !options.completedLessons.has(p),
  );

  if (missing.length === 0) {
    return { locked: false, blockedBy: [], reason: null };
  }

  const names = missing.map((p) => options.titleFor?.(p) ?? p);
  return {
    locked: true,
    blockedBy: missing,
    reason:
      names.length === 1
        ? `Complete "${names[0]}" first — this lesson builds directly on it.`
        : `Complete ${names.length} earlier lessons first: ${names.join(", ")}.`,
  };
}

export function evaluateModuleLock(options: {
  prerequisites: readonly string[];
  completedModules: ReadonlySet<string>;
  titleFor?: (path: string) => string;
}): LockState {
  const missing = options.prerequisites.filter(
    (p) => !options.completedModules.has(p),
  );

  if (missing.length === 0) {
    return { locked: false, blockedBy: [], reason: null };
  }

  const names = missing.map((p) => options.titleFor?.(p) ?? p);
  return {
    locked: true,
    blockedBy: missing,
    reason: `Finish ${names.join(" and ")} first.`,
  };
}

/** Terms 1–3 are always open; only Term 4 carries a business gate. */
export function evaluateTermLock(
  term: 1 | 2 | 3 | 4,
  term4: Term4UnlockState,
): LockState {
  if (term < 4) return { locked: false, blockedBy: [], reason: null };
  return {
    locked: !term4.unlocked,
    blockedBy: [],
    reason: term4.unlocked ? null : term4.message,
  };
}
