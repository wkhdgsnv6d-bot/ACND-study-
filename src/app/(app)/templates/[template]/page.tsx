import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Scale } from "lucide-react";

import { CopyMarkdownButton } from "@/components/templates/copy-button";
import { Card, CardBody, CardHeader } from "@/components/common/card";
import { PageHeader } from "@/components/common/page-header";
import {
  TEMPLATES,
  TEMPLATES_BY_KEY,
  templateToMarkdown,
} from "@/lib/domain/templates";

export async function generateStaticParams() {
  return TEMPLATES.map((t) => ({ template: t.key }));
}

export async function generateMetadata(
  props: PageProps<"/templates/[template]">,
): Promise<Metadata> {
  const { template } = await props.params;
  return { title: TEMPLATES_BY_KEY.get(template)?.name ?? "Template" };
}

export default async function TemplatePage(
  props: PageProps<"/templates/[template]">,
) {
  const { template: key } = await props.params;
  const template = TEMPLATES_BY_KEY.get(key);
  if (!template) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link href="/templates" className="text-muted-foreground hover:text-foreground">
          Templates
        </Link>
        <span className="mx-2 text-subtle-foreground" aria-hidden>
          /
        </span>
        <span className="text-foreground">{template.name}</span>
      </nav>

      <PageHeader
        title={template.name}
        description={template.summary}
        action={<CopyMarkdownButton markdown={templateToMarkdown(template)} />}
      />

      <Card className="mt-6">
        <CardBody className="py-4">
          <p className="text-sm text-muted-foreground text-pretty">
            <strong className="text-foreground">Why this exists.</strong>{" "}
            {template.rationale}
          </p>
        </CardBody>
      </Card>

      {template.requiresLegalReview ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-muted px-4 py-3">
          <Scale className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p className="min-w-0 text-sm text-muted-foreground text-pretty">
            This is a structure and a checklist, not a legal document. Have anything
            with money attached reviewed by an Australian solicitor.
          </p>
        </div>
      ) : null}

      <div className="mt-8 space-y-4">
        {template.sections.map((section) => (
          <Card key={section.heading}>
            <CardHeader title={section.heading} />
            <CardBody>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <span
                      aria-hidden
                      className="mt-0.5 size-3.5 shrink-0 rounded border border-border"
                    />
                    <span className="min-w-0 text-muted-foreground text-pretty">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
              {section.note ? (
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground italic text-pretty">
                  {section.note}
                </p>
              ) : null}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
