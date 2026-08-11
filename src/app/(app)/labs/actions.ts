"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { LABS_BY_ID } from "@/lib/domain/labs";
import { gradeLab, type LabResult } from "@/lib/engines/labs";
import { toDayKey } from "@/lib/engines/streak";
import { labXp } from "@/lib/engines/xp";
import { createClient, requireUser } from "@/lib/supabase/server";

/**
 * Lab submission.
 *
 * Graded on the server against the lab definition, so the answers are never in
 * the browser. XP tapers with attempts — solving it on the fifth guess is worth
 * less than working it out, and brute force should not pay the same as thought.
 */

export interface LabSubmissionResult extends LabResult {
  ok: boolean;
  message: string | null;
  attemptNumber: number;
  xpAwarded: number;
  /** Only revealed once solved — it lands harder after you have felt the problem. */
  inoculatesAgainst: string | null;
}

const submissionSchema = z.object({
  labId: z.string().regex(/^[a-z0-9-]+$/),
  answers: z.record(z.string(), z.union([z.string().max(500), z.array(z.string().max(20)).max(60)])),
});

export async function submitLab(input: {
  labId: string;
  answers: Record<string, string | string[]>;
}): Promise<LabSubmissionResult> {
  const empty: LabSubmissionResult = {
    ok: false,
    message: null,
    solved: false,
    correctCount: 0,
    totalCount: 0,
    results: [],
    attemptNumber: 0,
    xpAwarded: 0,
    inoculatesAgainst: null,
  };

  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { ...empty, message: "Invalid submission." };

  const lab = LABS_BY_ID.get(parsed.data.labId);
  if (!lab) return { ...empty, message: "That lab does not exist." };

  const graded = gradeLab(lab, parsed.data.answers);

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return { ...empty, ...graded, message: "Database not configured." };

  const { data: existing } = await supabase
    .from("lab_attempts")
    .select("attempt_number, solved")
    .eq("user_id", user.id)
    .eq("lab_id", lab.id)
    .maybeSingle();

  const previous = existing as { attempt_number: number; solved: boolean } | null;
  const alreadySolved = previous?.solved ?? false;
  const attemptNumber = (previous?.attempt_number ?? 0) + 1;

  const { error } = await supabase.from("lab_attempts").upsert(
    {
      user_id: user.id,
      lab_id: lab.id,
      attempt_number: attemptNumber,
      state: parsed.data.answers,
      solved: alreadySolved || graded.solved,
      solved_at:
        !alreadySolved && graded.solved ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lab_id" },
  );

  if (error) return { ...empty, ...graded, message: error.message };

  let xpAwarded = 0;
  if (graded.solved && !alreadySolved) {
    xpAwarded = labXp({ baseXp: lab.xp, attemptNumber, alreadySolved: false });

    await supabase.from("xp_events").upsert(
      {
        user_id: user.id,
        source_type: "lab_solved",
        source_id: lab.id,
        amount: xpAwarded,
        skill_xp: lab.skillXp,
      },
      { onConflict: "user_id,source_type,source_id", ignoreDuplicates: true },
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("time_zone")
      .eq("id", user.id)
      .maybeSingle();

    await supabase.from("study_sessions").insert({
      user_id: user.id,
      activity: "lab",
      ref: lab.id,
      started_at: new Date(Date.now() - lab.estimatedMinutes * 60_000).toISOString(),
      ended_at: new Date().toISOString(),
      seconds: lab.estimatedMinutes * 60,
      local_day: toDayKey(
        new Date(),
        (profile as { time_zone?: string } | null)?.time_zone ?? "Australia/Sydney",
      ),
    });

    await supabase.from("activity_log").insert({
      user_id: user.id,
      kind: "lab_solved",
      ref: lab.id,
      summary: `Solved “${lab.title}”`,
    });
  }

  revalidatePath(`/labs/${lab.id}`);
  revalidatePath("/labs");
  revalidatePath("/dashboard");

  return {
    ...graded,
    ok: true,
    message: null,
    attemptNumber,
    xpAwarded,
    inoculatesAgainst: graded.solved ? lab.inoculatesAgainst : null,
  };
}
