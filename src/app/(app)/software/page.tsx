import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { Card, CardBody } from "@/components/common/card";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { StatusPill } from "@/components/common/status-pill";
import { SKILLS } from "@/lib/domain/skills";
import {
  CATEGORY_LABELS,
  SOFTWARE,
  SOFTWARE_BACKLOG,
  SOFTWARE_CATEGORIES,
} from "@/lib/domain/software";

export const metadata: Metadata = { title: "Software Library" };

export default function SoftwarePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Software library"
        description="Every tool answers the same thirteen questions, because the useful thing about a tool is rarely its feature list — it is knowing when not to reach for it, what it costs at scale, and which mistake everyone makes first."
      />

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Documented"
          value={SOFTWARE.length}
          hint={`of ${SOFTWARE.length + SOFTWARE_BACKLOG.length} named in the curriculum`}
        />
        <StatCard label="Categories" value={SOFTWARE_CATEGORIES.length} />
        <StatCard
          label="Awaiting write-up"
          value={SOFTWARE_BACKLOG.length}
          tone="muted"
        />
      </section>

      {SOFTWARE_CATEGORIES.map((category) => {
        const entries = SOFTWARE.filter((s) => s.category === category);
        if (entries.length === 0) return null;

        return (
          <section key={category} className="mt-10">
            <h2 className="mb-3 text-sm font-semibold tracking-tight">
              {CATEGORY_LABELS[category]}
            </h2>
            <ul className="space-y-3">
              {entries.map((tool) => (
                <li key={tool.key}>
                  <Card>
                    <CardBody className="py-4">
                      <div className="flex items-start gap-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold tracking-tight">
                              {tool.name}
                            </h3>
                            <a
                              href={tool.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-subtle-foreground transition-colors hover:text-primary"
                              aria-label={`${tool.name} website`}
                            >
                              <ExternalLink className="size-3" aria-hidden />
                            </a>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground text-pretty">
                            {tool.summary}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-subtle-foreground">
                            {tool.skills.map((key) => (
                              <span key={key} className="flex items-center gap-1.5">
                                <span
                                  aria-hidden
                                  className="size-1.5 rounded-full"
                                  style={{
                                    backgroundColor: `var(${SKILLS[key].colorToken})`,
                                  }}
                                />
                                {SKILLS[key].name}
                              </span>
                            ))}
                            {tool.lastReviewed ? (
                              <span>Reviewed {tool.lastReviewed}</span>
                            ) : null}
                          </div>
                        </div>

                        <Link
                          href={`/software/${tool.key}`}
                          className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary"
                          aria-label={`Open ${tool.name}`}
                        >
                          <ArrowRight className="size-4" aria-hidden />
                        </Link>
                      </div>
                    </CardBody>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="mt-12">
        <h2 className="mb-2 text-sm font-semibold tracking-tight">
          Named in the curriculum, not yet written up
        </h2>
        <p className="mb-3 text-sm text-muted-foreground text-pretty">
          These appear in lessons but do not have a full entry yet. Listing them
          honestly is better than a page that says &ldquo;coming soon&rdquo;.
        </p>
        <ul className="flex flex-wrap gap-2">
          {SOFTWARE_BACKLOG.map((tool) => (
            <li key={tool.name}>
              <StatusPill tone="neutral">
                {tool.name}
                <span className="text-subtle-foreground">· {tool.note}</span>
              </StatusPill>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
