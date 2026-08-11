import type { SupabaseClient, User } from "@supabase/supabase-js";

import { PACKAGE_SEEDS } from "@/lib/domain/pricing";
import type { ServicePackage } from "@/lib/engines/finance";
import { DEFAULT_TERM_4_CONFIG, type Term4UnlockConfig } from "@/lib/engines/unlock";
import { createClient } from "@/lib/supabase/server";

/**
 * Settings, including Ascend's real service packages.
 *
 * The package rows here are what make the specification's rule work: a lesson
 * asking you to compute the Growth package's gross margin reads these exact
 * rows, not a textbook company's — as does every Business Lab calculator and
 * financial simulation. Nothing hard-codes a price anywhere.
 *
 * Prices are the founder's real figures. The internal planning assumptions
 * alongside them — maintenance hours and labour rate — are seeded estimates,
 * and `assumptionsReviewed` records that fact until delivery data replaces
 * them.
 */

export interface PackageRow extends ServicePackage {
  id: string;
  description: string | null;
  /** True only while the row still holds unedited seed prices. */
  isPlaceholder: boolean;
}

export interface UserSettings {
  displayName: string | null;
  timeZone: string;
  currency: string;
  dailyStudyTargetMinutes: number;
  deliverableHoursPerWeek: number;
  term4Unlock: Term4UnlockConfig;
  packages: PackageRow[];
  /** Set when a query failed, so the UI can say so instead of showing defaults. */
  error: string | null;
}

export async function getSettings(user: User): Promise<UserSettings> {
  const supabase = await createClient();
  if (!supabase) return emptySettings("Database not configured.");

  try {
    await ensureBootstrapped(supabase, user);

    const [profileResult, settingsResult, packagesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, time_zone, currency, daily_study_target_minutes")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("settings")
        .select("term4_unlock, deliverable_hours_per_week")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("pricing_packages")
        .select("*")
        .eq("user_id", user.id)
        .order("setup_price_cents"),
    ]);

    const failure = [profileResult, settingsResult, packagesResult].find((r) => r.error)
      ?.error;
    if (failure) throw new Error(failure.message);

    const profile = profileResult.data as {
      display_name: string | null;
      time_zone: string;
      currency: string;
      daily_study_target_minutes: number;
    } | null;

    const settings = settingsResult.data as {
      term4_unlock: unknown;
      deliverable_hours_per_week: number;
    } | null;

    return {
      displayName: profile?.display_name ?? null,
      timeZone: profile?.time_zone ?? "Australia/Sydney",
      currency: profile?.currency ?? "AUD",
      dailyStudyTargetMinutes: profile?.daily_study_target_minutes ?? 90,
      deliverableHoursPerWeek: settings?.deliverable_hours_per_week ?? 30,
      term4Unlock: mergeTerm4(settings?.term4_unlock),
      packages: (packagesResult.data ?? []).map(toPackageRow),
      error: null,
    };
  } catch (error) {
    return emptySettings(
      error instanceof Error ? error.message : "Could not load settings.",
    );
  }
}

/**
 * Creates the rows a new account needs. Idempotent — `onConflict` makes a
 * second call a no-op, so this can safely run on every settings load rather
 * than depending on a signup hook that might not fire.
 */
async function ensureBootstrapped(
  supabase: SupabaseClient,
  user: User,
): Promise<void> {
  await supabase
    .from("profiles")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  await supabase.from("settings").upsert(
    { user_id: user.id, term4_unlock: DEFAULT_TERM_4_CONFIG },
    { onConflict: "user_id", ignoreDuplicates: true },
  );

  // Seeded with Ascend's real prices. `ignoreDuplicates` makes this a no-op on
  // every call after the first, so editing a package here is never overwritten
  // by a later page load.
  await supabase.from("pricing_packages").upsert(
    PACKAGE_SEEDS.map((p) => ({
      user_id: user.id,
      tier: p.tier,
      name: p.name,
      description: p.description,
      setup_price_cents: p.setupPriceCents,
      monthly_price_cents: p.monthlyPriceCents,
      is_from_pricing: p.isFromPricing,
      setup_software_cost_cents: p.setupSoftwareCostCents,
      monthly_software_cost_cents: p.monthlySoftwareCostCents,
      setup_hours: p.setupHours,
      monthly_hours: p.monthlyHours,
      labour_rate_cents_per_hour: p.labourRateCentsPerHour,
      usage_billing: p.usageBilling,
      estimated_monthly_usage_cost_cents: p.estimatedMonthlyUsageCostCents,
      usage_allowance_cents: p.usageAllowanceCents,
      // The prices are real, so these are not placeholders — but the hours and
      // labour rate are unreviewed estimates until delivery data exists.
      is_placeholder: false,
      assumptions_reviewed: false,
    })),
    { onConflict: "user_id,tier", ignoreDuplicates: true },
  );
}

function toPackageRow(row: unknown): PackageRow {
  const r = row as {
    id: string;
    tier: ServicePackage["tier"];
    name: string;
    description: string | null;
    setup_price_cents: number;
    monthly_price_cents: number;
    is_from_pricing: boolean;
    setup_software_cost_cents: number;
    monthly_software_cost_cents: number;
    setup_hours: number;
    monthly_hours: number;
    labour_rate_cents_per_hour: number;
    usage_billing: ServicePackage["usageBilling"];
    estimated_monthly_usage_cost_cents: number;
    usage_allowance_cents: number;
    assumptions_reviewed: boolean;
    is_placeholder: boolean;
  };

  return {
    id: r.id,
    tier: r.tier,
    name: r.name,
    description: r.description,
    setupPriceCents: r.setup_price_cents,
    monthlyPriceCents: r.monthly_price_cents,
    isFromPricing: r.is_from_pricing,
    setupSoftwareCostCents: r.setup_software_cost_cents,
    monthlySoftwareCostCents: r.monthly_software_cost_cents,
    setupHours: r.setup_hours,
    monthlyHours: r.monthly_hours,
    labourRateCentsPerHour: r.labour_rate_cents_per_hour,
    usageBilling: r.usage_billing,
    estimatedMonthlyUsageCostCents: r.estimated_monthly_usage_cost_cents,
    usageAllowanceCents: r.usage_allowance_cents,
    assumptionsReviewed: r.assumptions_reviewed,
    isPlaceholder: r.is_placeholder,
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

function emptySettings(error: string): UserSettings {
  return {
    displayName: null,
    timeZone: "Australia/Sydney",
    currency: "AUD",
    dailyStudyTargetMinutes: 90,
    deliverableHoursPerWeek: 30,
    term4Unlock: DEFAULT_TERM_4_CONFIG,
    packages: [],
    error,
  };
}
