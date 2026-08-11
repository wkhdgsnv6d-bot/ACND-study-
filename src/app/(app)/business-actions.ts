"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dollarsToCents } from "@/lib/engines/finance";
import { milestoneXp } from "@/lib/engines/xp";
import { PROSPECT_STAGES } from "@/lib/domain/pipeline";
import { createClient, requireUser } from "@/lib/supabase/server";

/**
 * Pipeline, market validation and revenue.
 *
 * Business milestones are recorded automatically as the underlying facts
 * appear — a prospect reaching `won` records the first client, a payment
 * records the first collected revenue. These carry the highest XP in the
 * system because they are the only achievements that cannot be reached by
 * studying harder, so they must be driven by real records rather than by a
 * button that says "I did it".
 */

export interface RecordResult {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".")] ??= issue.message;
  return out;
}

async function recordMilestone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  key: string,
  options: { valueCents?: number; evidence?: string } = {},
): Promise<void> {
  if (!supabase) return;

  const { data } = await supabase
    .from("business_milestones")
    .select("id")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();

  if (data) return;

  await supabase.from("business_milestones").insert({
    user_id: userId,
    key,
    value_cents: options.valueCents ?? null,
    evidence: options.evidence ?? null,
  });

  await supabase.from("xp_events").upsert(
    {
      user_id: userId,
      source_type: "business_milestone",
      source_id: key,
      amount: milestoneXp(key),
      skill_xp: {},
    },
    { onConflict: "user_id,source_type,source_id", ignoreDuplicates: true },
  );

  await supabase.from("activity_log").insert({
    user_id: userId,
    kind: "milestone",
    ref: key,
    summary: `Milestone: ${key.replaceAll("-", " ")}`,
  });
}

/* ------------------------------------------------------------------ */
/* Prospects                                                           */
/* ------------------------------------------------------------------ */

const prospectSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  company: z.string().trim().min(1, "Company is required").max(200),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.string().trim().email("Not a valid email").optional().or(z.literal("")),
  industry: z.string().trim().max(120).optional(),
  source: z.string().trim().max(120).optional(),
  stage: z.enum(PROSPECT_STAGES),
  service: z.string().trim().max(120).optional(),
  estimatedValue: z.coerce.number().min(0).max(10_000_000),
  mrr: z.coerce.number().min(0).max(1_000_000),
  nextAction: z.string().trim().max(300).optional(),
  nextActionDue: z.string().trim().max(10).optional(),
  expectedCloseOn: z.string().trim().max(10).optional(),
  notes: z.string().trim().max(8000).optional(),
});

export async function saveProspect(formData: FormData): Promise<RecordResult> {
  const parsed = prospectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Database not configured." };

  const d = parsed.data;
  const payload = {
    user_id: user.id,
    company: d.company,
    contact_name: d.contactName || null,
    contact_email: d.contactEmail || null,
    industry: d.industry || null,
    source: d.source || null,
    stage: d.stage,
    service: d.service || null,
    estimated_value_cents: dollarsToCents(d.estimatedValue),
    mrr_cents: dollarsToCents(d.mrr),
    next_action: d.nextAction || null,
    next_action_due: d.nextActionDue || null,
    expected_close_on: d.expectedCloseOn || null,
    notes: d.notes || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = d.id
    ? await supabase.from("prospects").update(payload).eq("id", d.id).eq("user_id", user.id)
    : await supabase.from("prospects").insert({ ...payload, last_contact_at: new Date().toISOString() });

  if (error) return { ok: false, message: error.message };

  // Milestones follow from the record rather than from a self-report.
  if (d.stage !== "lead") {
    await recordMilestone(supabase, user.id, "first-prospect-contacted", {
      evidence: d.company,
    });
  }
  if (["replied", "discovery_booked", "qualified", "proposal_sent", "negotiation", "won", "onboarding", "delivery", "completed", "recurring"].includes(d.stage)) {
    await recordMilestone(supabase, user.id, "first-reply", { evidence: d.company });
  }
  if (["discovery_booked", "qualified", "proposal_sent", "negotiation", "won", "onboarding", "delivery", "completed", "recurring"].includes(d.stage)) {
    await recordMilestone(supabase, user.id, "first-discovery-call", { evidence: d.company });
  }
  if (["proposal_sent", "negotiation", "won", "onboarding", "delivery", "completed", "recurring"].includes(d.stage)) {
    await recordMilestone(supabase, user.id, "first-proposal-sent", { evidence: d.company });
  }
  if (["won", "onboarding", "delivery", "completed", "recurring"].includes(d.stage)) {
    await recordMilestone(supabase, user.id, "first-client-won", {
      valueCents: dollarsToCents(d.estimatedValue),
      evidence: d.company,
    });
  }
  if (d.stage === "completed" || d.stage === "recurring") {
    await recordMilestone(supabase, user.id, "first-project-delivered", {
      evidence: d.company,
    });
  }
  if (d.stage === "recurring" && d.mrr > 0) {
    await recordMilestone(supabase, user.id, "first-recurring-revenue", {
      valueCents: dollarsToCents(d.mrr),
      evidence: d.company,
    });
  }

  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return { ok: true, message: d.id ? "Updated." : "Prospect added." };
}

export async function moveProspect(
  id: string,
  stage: (typeof PROSPECT_STAGES)[number],
): Promise<RecordResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, message: "Invalid prospect." };
  }
  if (!PROSPECT_STAGES.includes(stage)) {
    return { ok: false, message: "Invalid stage." };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Database not configured." };

  const { error } = await supabase
    .from("prospects")
    .update({
      stage,
      last_contact_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, message: error.message };

  await supabase.from("prospect_activities").insert({
    user_id: user.id,
    prospect_id: id,
    type: "note",
    notes: `Moved to ${stage.replaceAll("_", " ")}`,
  });

  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return { ok: true, message: null };
}

export async function deleteProspect(id: string): Promise<RecordResult> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Database not configured." };

  const { error } = await supabase
    .from("prospects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/pipeline");
  return { ok: true, message: "Deleted." };
}

/* ------------------------------------------------------------------ */
/* Market validation                                                   */
/* ------------------------------------------------------------------ */

const validationSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  business: z.string().trim().min(1, "Business is required").max(200),
  industry: z.string().trim().max(120).optional(),
  contact: z.string().trim().max(120).optional(),
  problemDiscovered: z.string().trim().max(4000).optional(),
  currentSolution: z.string().trim().max(2000).optional(),
  costOfProblem: z.string().trim().max(500).optional(),
  urgency: z.enum(["low", "medium", "high", "critical"]).optional().or(z.literal("")),
  potentialService: z.string().trim().max(200).optional(),
  estimatedValue: z.coerce.number().min(0).max(10_000_000),
  followUp: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(8000).optional(),
});

export async function saveValidationInterview(
  formData: FormData,
): Promise<RecordResult> {
  const parsed = validationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Database not configured." };

  const d = parsed.data;
  const payload = {
    user_id: user.id,
    business: d.business,
    industry: d.industry || null,
    contact: d.contact || null,
    problem_discovered: d.problemDiscovered || null,
    current_solution: d.currentSolution || null,
    cost_of_problem: d.costOfProblem || null,
    urgency: d.urgency || null,
    potential_service: d.potentialService || null,
    estimated_value_cents: dollarsToCents(d.estimatedValue),
    follow_up: d.followUp || null,
    notes: d.notes || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = d.id
    ? await supabase
        .from("market_validation_interviews")
        .update(payload)
        .eq("id", d.id)
        .eq("user_id", user.id)
    : await supabase.from("market_validation_interviews").insert(payload);

  if (error) return { ok: false, message: error.message };

  const { count } = await supabase
    .from("market_validation_interviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  await recordMilestone(supabase, user.id, "first-validation-interview");
  if ((count ?? 0) >= 5) {
    await recordMilestone(supabase, user.id, "five-validation-interviews");
  }

  revalidatePath("/validation");
  revalidatePath("/dashboard");
  revalidatePath("/certifications");
  return { ok: true, message: d.id ? "Updated." : "Interview recorded." };
}

export async function deleteValidationInterview(id: string): Promise<RecordResult> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Database not configured." };

  const { error } = await supabase
    .from("market_validation_interviews")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/validation");
  return { ok: true, message: "Deleted." };
}

/* ------------------------------------------------------------------ */
/* Revenue and clients                                                 */
/* ------------------------------------------------------------------ */

const revenueSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  clientId: z.string().uuid().optional().or(z.literal("")),
  type: z.enum(["project", "setup", "recurring", "other"]),
  amount: z.coerce.number().min(0.01, "Enter an amount").max(10_000_000),
  incurredOn: z.string().trim().min(10, "Enter a date").max(10),
  invoiced: z.coerce.boolean(),
  paidOn: z.string().trim().max(10).optional(),
  description: z.string().trim().max(500).optional(),
});

export async function saveRevenueEntry(formData: FormData): Promise<RecordResult> {
  const parsed = revenueSchema.safeParse({
    ...Object.fromEntries(formData),
    invoiced: formData.get("invoiced") === "on",
  });
  if (!parsed.success) {
    return { ok: false, message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Database not configured." };

  const d = parsed.data;
  const { error } = await supabase.from("revenue_entries").insert({
    user_id: user.id,
    client_id: d.clientId || null,
    type: d.type,
    amount_cents: dollarsToCents(d.amount),
    incurred_on: d.incurredOn,
    invoiced: d.invoiced,
    paid_on: d.paidOn || null,
    description: d.description || null,
  });

  if (error) return { ok: false, message: error.message };

  if (d.paidOn) {
    await recordMilestone(supabase, user.id, "first-payment-collected", {
      valueCents: dollarsToCents(d.amount),
      evidence: d.description ?? undefined,
    });
  }

  revalidatePath("/revenue");
  revalidatePath("/dashboard");
  return { ok: true, message: "Recorded." };
}

const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  industry: z.string().trim().max(120).optional(),
  status: z.enum(["active", "paused", "churned", "completed"]),
  contractValue: z.coerce.number().min(0).max(10_000_000),
  mrr: z.coerce.number().min(0).max(1_000_000),
  startDate: z.string().trim().max(10).optional(),
  docsUrl: z.string().trim().url().optional().or(z.literal("")),
});

export async function saveClient(formData: FormData): Promise<RecordResult> {
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Database not configured." };

  const d = parsed.data;
  const { error } = await supabase.from("clients").insert({
    user_id: user.id,
    name: d.name,
    industry: d.industry || null,
    status: d.status,
    contract_value_cents: dollarsToCents(d.contractValue),
    mrr_cents: dollarsToCents(d.mrr),
    start_date: d.startDate || null,
    docs_url: d.docsUrl || null,
  });

  if (error) return { ok: false, message: error.message };

  await recordMilestone(supabase, user.id, "first-client-won", {
    valueCents: dollarsToCents(d.contractValue),
    evidence: d.name,
  });
  if (d.mrr > 0 && d.status === "active") {
    await recordMilestone(supabase, user.id, "first-recurring-revenue", {
      valueCents: dollarsToCents(d.mrr),
      evidence: d.name,
    });
  }

  revalidatePath("/revenue");
  revalidatePath("/dashboard");
  return { ok: true, message: "Client added." };
}
