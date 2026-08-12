import { NextResponse } from "next/server";

import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * Data export.
 *
 * The platform holds real business information — clients, revenue, prospects,
 * notes. Being able to take it out is not a feature, it is a condition of
 * trusting it with anything that matters. Every table is exported as JSON,
 * scoped to the signed-in account by row-level security.
 */

const TABLES = [
  "profiles",
  "settings",
  "pricing_packages",
  "lesson_progress",
  "study_sessions",
  "xp_events",
  "quiz_attempts",
  "question_responses",
  "exam_attempts",
  "submissions",
  "lab_attempts",
  "certifications",
  "review_cards",
  "review_logs",
  "notes",
  "projects",
  "prospects",
  "prospect_activities",
  "clients",
  "revenue_entries",
  "costs",
  "market_validation_interviews",
  "business_milestones",
  "sops",
  "template_instances",
  "achievements",
  "activity_log",
] as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const data: Record<string, unknown[]> = {};
  const failures: string[] = [];

  for (const table of TABLES) {
    const { data: rows, error } = await supabase.from(table).select("*");
    if (error) {
      failures.push(`${table}: ${error.message}`);
      continue;
    }
    data[table] = rows ?? [];
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    account: user.email,
    // Reported rather than swallowed — a partial export that looks complete is
    // worse than one that says what is missing.
    incomplete: failures.length > 0 ? failures : undefined,
    data,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="ascend-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
