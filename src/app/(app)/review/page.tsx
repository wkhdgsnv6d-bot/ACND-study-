import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Repeat2 } from "lucide-react";

import { ReviewSession } from "@/app/(app)/review/review-session";
import { Card, CardBody, CardHeader } from "@/components/common/card";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/states";
import { buildReviewConcepts, loadCurriculum } from "@/lib/content/loader";
import { getReviewDeck } from "@/lib/queries/study";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const deck = await getReviewDeck(user);
  const { curriculum } = loadCurriculum();
  const concepts = Object.fromEntries(buildReviewConcepts());

  const lessonTitles = Object.fromEntries(
    [...curriculum.lessonsByPath.values()].map((lesson) => [
      lesson.path,
      {
        title: lesson.frontmatter.title,
        href: `/course/${lesson.termSlug}/${lesson.moduleSlug}/${lesson.slug}`,
      },
    ]),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Review"
        description="Concepts return before you forget them. Cards born from a wrong answer come back sooner than ones you simply read."
      />

      {deck.error ? <ErrorState className="mt-6" description={deck.error} /> : null}

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Due now"
          value={deck.due.length}
          tone={deck.due.length > 0 ? "primary" : "muted"}
        />
        <StatCard label="Total cards" value={deck.stats.totalCards} />
        <StatCard
          label="Matured"
          value={deck.stats.matured}
          hint="3+ reps, 21+ day interval"
          tone={deck.stats.matured > 0 ? "success" : "muted"}
        />
        <StatCard
          label="Struggling"
          value={deck.stats.struggling}
          hint="3+ lapses"
          tone={deck.stats.struggling > 0 ? "muted" : undefined}
        />
      </section>

      <div className="mt-8">
        {deck.due.length === 0 ? (
          <EmptyState
            icon={Repeat2}
            title="Nothing due today"
            description={
              deck.stats.totalCards === 0
                ? "Cards are created when you complete a lesson, and immediately when you get a question wrong."
                : "Everything is scheduled for a future day. Come back tomorrow."
            }
          />
        ) : (
          <ReviewSession
            cards={deck.due}
            lessonTitles={lessonTitles}
            concepts={concepts}
          />
        )}
      </div>

      {deck.struggling.length > 0 ? (
        <Card className="mt-8">
          <CardHeader
            title="Concepts that keep failing"
            description="These have lapsed repeatedly. Re-reading the lesson usually beats another review."
          />
          <CardBody>
            <ul className="space-y-2">
              {deck.struggling.map((item) => (
                <li
                  key={item.conceptKey}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 text-muted-foreground">
                    {concepts[item.conceptKey]?.prompt ??
                      item.conceptKey.replaceAll("-", " ")}
                  </span>
                  <span className="font-mono text-xs text-warning">
                    {item.lapses} lapses
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
