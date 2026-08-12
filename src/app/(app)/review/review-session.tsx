"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { gradeCard } from "@/app/(app)/review/actions";
import { Card, CardBody } from "@/components/common/card";
import { ProgressBar } from "@/components/common/progress-bar";
import { Button } from "@/components/ui/button";
import type { Rating, ReviewCard } from "@/lib/engines/srs";

/**
 * A review session.
 *
 * The concept is shown, you decide whether you actually knew it, then you see
 * the lesson it came from. Self-graded on purpose: the value of spaced
 * repetition comes from an honest signal, and nobody else is watching.
 */

const RATINGS: Array<{ value: Rating; label: string; hint: string; tone: string }> = [
  { value: "again", label: "Again", hint: "No idea", tone: "border-destructive/40 hover:bg-destructive-muted" },
  { value: "hard", label: "Hard", hint: "Got there slowly", tone: "border-warning/40 hover:bg-warning-muted" },
  { value: "good", label: "Good", hint: "Knew it", tone: "border-success/40 hover:bg-success-muted" },
  { value: "easy", label: "Easy", hint: "Instant", tone: "border-info/40 hover:bg-info-muted" },
];

export function ReviewSession({
  cards,
  lessonTitles,
  concepts,
}: {
  cards: ReviewCard[];
  lessonTitles: Record<string, { title: string; href: string }>;
  /** Prompt and answer text, resolved from lesson content by concept key. */
  concepts: Record<string, { prompt: string; answer: string }>;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const card = cards[index];

  if (done || !card) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <CheckCircle2 className="mx-auto size-6 text-success" aria-hidden />
          <h2 className="mt-3 text-sm font-medium">Review complete</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {cards.length} card{cards.length === 1 ? "" : "s"} reviewed. The ones you
            found hard will come back sooner.
          </p>
          <Button asChild className="mt-5" variant="secondary" size="sm">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardBody>
      </Card>
    );
  }

  const source = lessonTitles[card.lessonPath];
  const concept = concepts[card.conceptKey];

  function grade(rating: Rating) {
    const current = card;
    if (!current) return;
    startTransition(async () => {
      await gradeCard({ cardId: current.id, rating });
      if (index + 1 >= cards.length) {
        setDone(true);
      } else {
        setIndex(index + 1);
        setRevealed(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
          <span className="text-muted-foreground">
            {index + 1} of {cards.length}
          </span>
          <span className="font-mono text-subtle-foreground tabular-nums">
            {Math.round((index / cards.length) * 100)}%
          </span>
        </div>
        <ProgressBar
          label="Review session progress"
          value={index / cards.length}
          size="sm"
        />
      </div>

      <Card elevated>
        <CardBody className="py-10 text-center">
          {card.fromMistake ? (
            <p className="mb-3 text-xs text-warning">
              You got this wrong before
            </p>
          ) : null}

          <h2 className="mx-auto max-w-lg text-balance text-xl font-semibold tracking-tight">
            {concept?.prompt ?? card.conceptKey.replaceAll("-", " ")}
          </h2>

          {revealed ? (
            <div className="mt-6 space-y-4">
              {concept ? (
                <p className="mx-auto max-w-xl text-left text-sm leading-relaxed text-muted-foreground">
                  {concept.answer}
                </p>
              ) : (
                /*
                 * The concept was removed or renamed in the content since this
                 * card was created. Say so plainly rather than showing a blank
                 * card and letting the learner think they have forgotten
                 * something that no longer exists.
                 */
                <p className="mx-auto max-w-xl text-sm text-warning">
                  This concept is no longer in the curriculum. Grade it “Easy” to
                  push it far out, or open the lesson to see what replaced it.
                </p>
              )}

              <div className="space-y-1 border-t border-border pt-4">
                {source ? (
                  <Link
                    href={source.href}
                    className="text-sm text-primary hover:underline"
                  >
                    {source.title}
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">{card.lessonPath}</p>
                )}
                <p className="text-xs text-subtle-foreground">
                  Reviewed {card.repetitions} time{card.repetitions === 1 ? "" : "s"}
                  {card.lapses > 0 ? ` · ${card.lapses} lapse${card.lapses === 1 ? "" : "s"}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Answer it out loud first. Grading yourself on a recall you never
              attempted is how review time gets wasted.
            </p>
          )}
        </CardBody>
      </Card>

      {revealed ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((rating) => (
            <button
              key={rating.value}
              type="button"
              disabled={pending}
              onClick={() => grade(rating.value)}
              className={`rounded-lg border px-3 py-3 text-center transition-colors ${rating.tone} disabled:opacity-50`}
            >
              <span className="block text-sm font-medium">{rating.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {rating.hint}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Button className="w-full" onClick={() => setRevealed(true)}>
          Show the answer
        </Button>
      )}
    </div>
  );
}
