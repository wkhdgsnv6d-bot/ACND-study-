"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { reviewCard, type Rating, type ReviewCard } from "@/lib/engines/srs";
import { toDayKey } from "@/lib/engines/streak";
import { XP_AWARDS } from "@/lib/engines/xp";
import { createClient, requireUser } from "@/lib/supabase/server";

/**
 * Grading a review card.
 *
 * The scheduling decision is made by the pure SM-2 engine; this only persists
 * the result and logs the review. Session XP is awarded once per day rather
 * than per card, so grinding twenty cards is not worth twenty awards.
 */

const gradeSchema = z.object({
  cardId: z.string().uuid(),
  rating: z.enum(["again", "hard", "good", "easy"]),
});

export interface GradeResult {
  ok: boolean;
  message: string | null;
  nextIntervalDays: number;
}

export async function gradeCard(input: {
  cardId: string;
  rating: Rating;
}): Promise<GradeResult> {
  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid review.", nextIntervalDays: 0 };
  }

  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, message: "Database not configured.", nextIntervalDays: 0 };
  }

  const [{ data: profile }, { data: row, error }] = await Promise.all([
    supabase.from("profiles").select("time_zone").eq("id", user.id).maybeSingle(),
    supabase
      .from("review_cards")
      .select("*")
      .eq("id", parsed.data.cardId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (error || !row) {
    return { ok: false, message: "Card not found.", nextIntervalDays: 0 };
  }

  const r = row as Record<string, unknown>;
  const card: ReviewCard = {
    id: r.id as string,
    conceptKey: r.concept_key as string,
    lessonPath: r.lesson_path as string,
    ease: r.ease as number,
    intervalDays: r.interval_days as number,
    repetitions: r.repetitions as number,
    dueOn: r.due_on as string,
    lapses: r.lapses as number,
    fromMistake: r.from_mistake as boolean,
  };

  const timeZone =
    (profile as { time_zone?: string } | null)?.time_zone ?? "Australia/Sydney";
  const today = toDayKey(new Date(), timeZone);
  const next = reviewCard(card, parsed.data.rating, today);

  const { error: updateError } = await supabase
    .from("review_cards")
    .update({
      ease: next.ease,
      interval_days: next.intervalDays,
      repetitions: next.repetitions,
      due_on: next.dueOn,
      lapses: next.lapses,
      updated_at: new Date().toISOString(),
    })
    .eq("id", card.id)
    .eq("user_id", user.id);

  if (updateError) {
    return { ok: false, message: updateError.message, nextIntervalDays: 0 };
  }

  await supabase.from("review_logs").insert({
    user_id: user.id,
    card_id: card.id,
    rating: parsed.data.rating,
    interval_after_days: next.intervalDays,
  });

  // One award per day, not per card.
  await supabase.from("xp_events").upsert(
    {
      user_id: user.id,
      source_type: "review_session",
      source_id: today,
      amount: XP_AWARDS.reviewSession,
      skill_xp: {},
    },
    { onConflict: "user_id,source_type,source_id", ignoreDuplicates: true },
  );

  await supabase.from("study_sessions").insert({
    user_id: user.id,
    activity: "review",
    ref: card.conceptKey,
    started_at: new Date(Date.now() - 60_000).toISOString(),
    ended_at: new Date().toISOString(),
    seconds: 60,
    local_day: today,
  });

  revalidatePath("/review");
  revalidatePath("/dashboard");
  return { ok: true, message: null, nextIntervalDays: next.intervalDays };
}
