"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dollarsToCents } from "@/lib/engines/finance";
import { createClient, requireUser } from "@/lib/supabase/server";

/**
 * Settings mutations.
 *
 * Every action re-authenticates rather than trusting that `proxy.ts` ran —
 * server actions are directly invocable endpoints, and treating them as
 * protected-by-association is how authorisation bugs happen. Row-level security
 * is the third layer: even a forged user id cannot reach another account's rows.
 */

export interface ActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors?: Record<string, string>;
}

export const IDLE: ActionState = { status: "idle", message: null };

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

const profileSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
  timeZone: z
    .string()
    .trim()
    .min(1, "Pick a timezone — streaks are counted in local calendar days"),
  currency: z.string().trim().length(3, "Use a three-letter currency code"),
  dailyStudyTargetMinutes: z.coerce
    .number()
    .int()
    .min(10, "Aim for at least 10 minutes")
    .max(600),
});

export async function updateProfile(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName") ?? undefined,
    timeZone: formData.get("timeZone"),
    currency: formData.get("currency"),
    dailyStudyTargetMinutes: formData.get("dailyStudyTargetMinutes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: null,
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  // Reject a timezone the runtime cannot resolve — an invalid one would
  // silently corrupt every streak calculation from here on.
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: parsed.data.timeZone });
  } catch {
    return {
      status: "error",
      message: null,
      fieldErrors: { timeZone: "That is not a recognised IANA timezone" },
    };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { status: "error", message: "Database not configured." };

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: parsed.data.displayName || null,
      time_zone: parsed.data.timeZone,
      currency: parsed.data.currency.toUpperCase(),
      daily_study_target_minutes: parsed.data.dailyStudyTargetMinutes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) return { status: "error", message: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { status: "success", message: "Profile saved." };
}

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

const money = z.coerce.number().min(0).max(1_000_000);
const hours = z.coerce.number().min(0).max(2000);

const packageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Give the package a name").max(60),
  setupPrice: money,
  monthlyPrice: money,
  setupSoftwareCost: money,
  monthlySoftwareCost: money,
  setupHours: hours,
  monthlyHours: hours,
  labourRate: money,
});

/**
 * Saves one package. Entering any non-zero figure clears `isPlaceholder`, which
 * is what stops the platform describing your numbers as defaults once they are
 * genuinely yours.
 */
export async function updatePackage(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = packageSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    setupPrice: formData.get("setupPrice"),
    monthlyPrice: formData.get("monthlyPrice"),
    setupSoftwareCost: formData.get("setupSoftwareCost"),
    monthlySoftwareCost: formData.get("monthlySoftwareCost"),
    setupHours: formData.get("setupHours"),
    monthlyHours: formData.get("monthlyHours"),
    labourRate: formData.get("labourRate"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: null,
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { status: "error", message: "Database not configured." };

  const d = parsed.data;
  const entered =
    d.setupPrice > 0 || d.monthlyPrice > 0 || d.setupHours > 0 || d.monthlyHours > 0;

  const { error } = await supabase
    .from("pricing_packages")
    .update({
      name: d.name,
      setup_price_cents: dollarsToCents(d.setupPrice),
      monthly_price_cents: dollarsToCents(d.monthlyPrice),
      setup_software_cost_cents: dollarsToCents(d.setupSoftwareCost),
      monthly_software_cost_cents: dollarsToCents(d.monthlySoftwareCost),
      setup_hours: d.setupHours,
      monthly_hours: d.monthlyHours,
      labour_rate_cents_per_hour: dollarsToCents(d.labourRate),
      is_placeholder: !entered,
      updated_at: new Date().toISOString(),
    })
    .eq("id", d.id)
    // Redundant given row-level security, but explicit ownership in the query
    // means a policy mistake cannot become a cross-account write.
    .eq("user_id", user.id);

  if (error) return { status: "error", message: error.message };

  revalidatePath("/settings");
  return { status: "success", message: `${d.name} saved.` };
}

/* ------------------------------------------------------------------ */
/* Term 4 unlock                                                       */
/* ------------------------------------------------------------------ */

const unlockSchema = z.object({
  enabled: z.coerce.boolean(),
  mode: z.enum(["any", "all"]),
  monthlyRevenue: z.coerce.number().min(0).max(10_000_000),
  mrr: z.coerce.number().min(0).max(10_000_000),
  activeClients: z.coerce.number().int().min(0).max(1000),
  contractors: z.coerce.number().int().min(0).max(1000),
  overrideReason: z.string().trim().max(300).optional(),
});

export async function updateTerm4Unlock(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = unlockSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    mode: formData.get("mode"),
    monthlyRevenue: formData.get("monthlyRevenue"),
    mrr: formData.get("mrr"),
    activeClients: formData.get("activeClients"),
    contractors: formData.get("contractors"),
    overrideReason: formData.get("overrideReason") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: null,
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { status: "error", message: "Database not configured." };

  const d = parsed.data;
  const reason = d.overrideReason?.trim();

  const { error } = await supabase.from("settings").upsert(
    {
      user_id: user.id,
      term4_unlock: {
        enabled: d.enabled,
        mode: d.mode,
        thresholds: {
          monthlyRevenue: d.monthlyRevenue,
          mrr: d.mrr,
          activeClients: d.activeClients,
          contractors: d.contractors,
        },
        // An override is only recorded with a stated reason. Unlocking Term 4
        // should be a decision you can be reminded of later, not a stray click.
        manualOverride: reason
          ? { unlockedAt: new Date().toISOString(), reason }
          : null,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return { status: "error", message: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { status: "success", message: "Unlock rules saved." };
}
