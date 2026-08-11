import type { User } from "@supabase/supabase-js";

import type { PackageRow } from "@/lib/queries/settings";
import type { ProspectStage } from "@/lib/domain/pipeline";
import { getSettings } from "@/lib/queries/settings";
import { createClient } from "@/lib/supabase/server";

/**
 * Business data.
 *
 * Every calculator, exercise and simulation in the platform reads Ascend's
 * packages through here rather than holding its own numbers, which is what
 * makes changing a price in Settings change every downstream figure.
 */

export interface ProspectRow {
  id: string;
  company: string;
  contactName: string | null;
  contactEmail: string | null;
  industry: string | null;
  source: string | null;
  stage: ProspectStage;
  service: string | null;
  estimatedValueCents: number;
  mrrCents: number;
  actualRevenueCents: number;
  nextAction: string | null;
  nextActionDue: string | null;
  expectedCloseOn: string | null;
  lastContactAt: string | null;
  notes: string | null;
}

export interface ValidationRow {
  id: string;
  business: string;
  industry: string | null;
  contact: string | null;
  problemDiscovered: string | null;
  currentSolution: string | null;
  costOfProblem: string | null;
  urgency: "low" | "medium" | "high" | "critical" | null;
  potentialService: string | null;
  estimatedValueCents: number;
  followUp: string | null;
  notes: string | null;
  conductedAt: string;
}

export interface RevenueRow {
  id: string;
  clientId: string | null;
  type: "project" | "setup" | "recurring" | "other";
  amountCents: number;
  incurredOn: string;
  invoiced: boolean;
  paidOn: string | null;
  description: string | null;
}

export interface ClientRow {
  id: string;
  name: string;
  industry: string | null;
  status: "active" | "paused" | "churned" | "completed";
  contractValueCents: number;
  mrrCents: number;
  startDate: string | null;
  docsUrl: string | null;
}

export async function getPackages(user: User): Promise<PackageRow[]> {
  const settings = await getSettings(user);
  return settings.packages;
}

export async function getProspects(
  user: User,
): Promise<{ rows: ProspectRow[]; error: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { rows: [], error: "Database not configured." };

  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return { rows: [], error: error.message };

  return {
    rows: (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        company: r.company as string,
        contactName: (r.contact_name as string) ?? null,
        contactEmail: (r.contact_email as string) ?? null,
        industry: (r.industry as string) ?? null,
        source: (r.source as string) ?? null,
        stage: r.stage as ProspectStage,
        service: (r.service as string) ?? null,
        estimatedValueCents: (r.estimated_value_cents as number) ?? 0,
        mrrCents: (r.mrr_cents as number) ?? 0,
        actualRevenueCents: (r.actual_revenue_cents as number) ?? 0,
        nextAction: (r.next_action as string) ?? null,
        nextActionDue: (r.next_action_due as string) ?? null,
        expectedCloseOn: (r.expected_close_on as string) ?? null,
        lastContactAt: (r.last_contact_at as string) ?? null,
        notes: (r.notes as string) ?? null,
      };
    }),
    error: null,
  };
}

export async function getValidationInterviews(
  user: User,
): Promise<{ rows: ValidationRow[]; error: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { rows: [], error: "Database not configured." };

  const { data, error } = await supabase
    .from("market_validation_interviews")
    .select("*")
    .eq("user_id", user.id)
    .order("conducted_at", { ascending: false });

  if (error) return { rows: [], error: error.message };

  return {
    rows: (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        business: r.business as string,
        industry: (r.industry as string) ?? null,
        contact: (r.contact as string) ?? null,
        problemDiscovered: (r.problem_discovered as string) ?? null,
        currentSolution: (r.current_solution as string) ?? null,
        costOfProblem: (r.cost_of_problem as string) ?? null,
        urgency: (r.urgency as ValidationRow["urgency"]) ?? null,
        potentialService: (r.potential_service as string) ?? null,
        estimatedValueCents: (r.estimated_value_cents as number) ?? 0,
        followUp: (r.follow_up as string) ?? null,
        notes: (r.notes as string) ?? null,
        conductedAt: r.conducted_at as string,
      };
    }),
    error: null,
  };
}

export async function getRevenue(user: User): Promise<{
  entries: RevenueRow[];
  clients: ClientRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  if (!supabase) {
    return { entries: [], clients: [], error: "Database not configured." };
  }

  const [entryResult, clientResult] = await Promise.all([
    supabase
      .from("revenue_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("incurred_on", { ascending: false }),
    supabase
      .from("clients")
      .select("*")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false }),
  ]);

  const failure = [entryResult, clientResult].find((r) => r.error)?.error;

  return {
    entries: (entryResult.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        clientId: (r.client_id as string) ?? null,
        type: r.type as RevenueRow["type"],
        amountCents: r.amount_cents as number,
        incurredOn: r.incurred_on as string,
        invoiced: r.invoiced as boolean,
        paidOn: (r.paid_on as string) ?? null,
        description: (r.description as string) ?? null,
      };
    }),
    clients: (clientResult.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        name: r.name as string,
        industry: (r.industry as string) ?? null,
        status: r.status as ClientRow["status"],
        contractValueCents: (r.contract_value_cents as number) ?? 0,
        mrrCents: (r.mrr_cents as number) ?? 0,
        startDate: (r.start_date as string) ?? null,
        docsUrl: (r.docs_url as string) ?? null,
      };
    }),
    error: failure?.message ?? null,
  };
}
