import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";

import { Card, CardBody } from "@/components/common/card";
import { PageHeader } from "@/components/common/page-header";
import { StatusPill } from "@/components/common/status-pill";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATES,
} from "@/lib/domain/templates";

export const metadata: Metadata = { title: "Templates" };

export default function TemplatesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Template vault"
        description="Checklists and structures for running Ascend. The value is in what they stop you forgetting, not in the wording."
      />

      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-muted px-4 py-3">
        <Scale className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <p className="min-w-0 text-sm text-muted-foreground text-pretty">
          <strong className="text-foreground">Not legal documents.</strong> The scope
          and proposal templates are prompts for a conversation and a starting
          structure. They do not replace advice from an Australian solicitor, and
          anything you put in front of a client with money attached should be reviewed
          by one.
        </p>
      </div>

      {TEMPLATE_CATEGORIES.map((category) => {
        const items = TEMPLATES.filter((t) => t.category === category);
        if (items.length === 0) return null;

        return (
          <section key={category} className="mt-10">
            <h2 className="mb-3 text-sm font-semibold tracking-tight">
              {TEMPLATE_CATEGORY_LABELS[category]}
            </h2>
            <ul className="space-y-3">
              {items.map((template) => (
                <li key={template.key}>
                  <Card>
                    <CardBody className="py-4">
                      <div className="flex items-start gap-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold tracking-tight">
                              {template.name}
                            </h3>
                            {template.requiresLegalReview ? (
                              <StatusPill tone="warning">Needs legal review</StatusPill>
                            ) : null}
                            <span className="text-xs text-subtle-foreground">
                              {template.sections.length} sections
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground text-pretty">
                            {template.summary}
                          </p>
                        </div>
                        <Link
                          href={`/templates/${template.key}`}
                          className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary"
                          aria-label={`Open ${template.name}`}
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
    </div>
  );
}
