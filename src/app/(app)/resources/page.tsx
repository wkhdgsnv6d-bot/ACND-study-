import type { Metadata } from "next";
import Link from "next/link";
import { BookMarked, ExternalLink } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/common/card";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { StatusPill } from "@/components/common/status-pill";
import { buildGlossary, loadCurriculum } from "@/lib/content/loader";
import type { ResourceLink } from "@/lib/content/schema";

export const metadata: Metadata = { title: "Resources" };

const TYPE_LABEL: Record<ResourceLink["type"], string> = {
  docs: "Documentation",
  article: "Article",
  video: "Video",
  tool: "Tool",
  spec: "Specification",
  template: "Template",
};

export default function ResourcesPage() {
  const { curriculum } = loadCurriculum();
  const glossary = buildGlossary();

  const resources = [...curriculum.lessonsByPath.values()].flatMap((lesson) =>
    lesson.frontmatter.resources.map((resource) => ({
      ...resource,
      lessonTitle: lesson.frontmatter.title,
      lessonHref: `/course/${lesson.termSlug}/${lesson.moduleSlug}/${lesson.slug}`,
    })),
  );

  const byType = new Map<ResourceLink["type"], typeof resources>();
  for (const resource of resources) {
    byType.set(resource.type, [...(byType.get(resource.type) ?? []), resource]);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Resources"
        description="External references cited across the curriculum, and every term the lessons define."
      />

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="External references" value={resources.length} />
        <StatCard label="Glossary terms" value={glossary.length} />
        <StatCard label="Lessons" value={curriculum.lessonsByPath.size} />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">External references</h2>
        {resources.length === 0 ? (
          <EmptyState
            title="No references yet"
            description="Resources cited by lessons collect here as the curriculum is written."
          />
        ) : (
          <div className="space-y-6">
            {[...byType.entries()].map(([type, items]) => (
              <Card key={type}>
                <CardHeader title={TYPE_LABEL[type]} />
                <CardBody>
                  <ul className="space-y-3">
                    {items.map((resource) => (
                      <li key={resource.url}>
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="flex items-start gap-1.5 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
                          <span className="min-w-0 text-pretty">{resource.label}</span>
                        </a>
                        {resource.note ? (
                          <p className="mt-0.5 ml-4.5 text-xs text-muted-foreground text-pretty">
                            {resource.note}
                          </p>
                        ) : null}
                        <Link
                          href={resource.lessonHref}
                          className="mt-0.5 ml-4.5 block text-xs text-subtle-foreground hover:text-foreground"
                        >
                          from {resource.lessonTitle}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Glossary</h2>
        {glossary.length === 0 ? (
          <EmptyState icon={BookMarked} title="No terms defined yet" />
        ) : (
          <Card>
            <CardBody>
              <dl className="space-y-4">
                {glossary.map((entry) => (
                  <div key={`${entry.term}-${entry.lessonPath}`}>
                    <dt className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{entry.term}</span>
                      <StatusPill tone="neutral">{entry.lessonTitle}</StatusPill>
                    </dt>
                    <dd className="mt-0.5 text-sm text-muted-foreground text-pretty">
                      {entry.definition}
                    </dd>
                    {entry.plainEnglish ? (
                      <dd className="mt-0.5 text-xs text-subtle-foreground italic text-pretty">
                        {entry.plainEnglish}
                      </dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        )}
      </section>
    </div>
  );
}
