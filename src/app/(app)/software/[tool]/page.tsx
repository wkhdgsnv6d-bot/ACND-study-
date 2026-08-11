import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Wallet,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardBody, CardHeader } from "@/components/common/card";
import { PageHeader } from "@/components/common/page-header";
import { StatusPill } from "@/components/common/status-pill";
import { SKILLS } from "@/lib/domain/skills";
import { CATEGORY_LABELS, SOFTWARE, SOFTWARE_BY_KEY } from "@/lib/domain/software";

export async function generateStaticParams() {
  return SOFTWARE.map((s) => ({ tool: s.key }));
}

export async function generateMetadata(
  props: PageProps<"/software/[tool]">,
): Promise<Metadata> {
  const { tool } = await props.params;
  const entry = SOFTWARE_BY_KEY.get(tool);
  return { title: entry?.name ?? "Software", description: entry?.summary };
}

export default async function SoftwarePage(props: PageProps<"/software/[tool]">) {
  const { tool: key } = await props.params;
  const tool = SOFTWARE_BY_KEY.get(key);
  if (!tool) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link href="/software" className="text-muted-foreground hover:text-foreground">
          Software
        </Link>
        <span className="mx-2 text-subtle-foreground" aria-hidden>
          /
        </span>
        <span className="text-foreground">{tool.name}</span>
      </nav>

      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="primary">{CATEGORY_LABELS[tool.category]}</StatusPill>
            {tool.skills.map((skillKey) => (
              <StatusPill key={skillKey} tone="neutral">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: `var(${SKILLS[skillKey].colorToken})` }}
                />
                {SKILLS[skillKey].name}
              </StatusPill>
            ))}
          </div>
        }
        title={tool.name}
        description={tool.summary}
        action={
          <a
            href={tool.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Website
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        }
      />

      {tool.lastReviewed ? (
        <p className="mt-4 text-xs text-subtle-foreground">
          Vendor-specific detail last reviewed {tool.lastReviewed}. Interfaces change;
          the concepts taught in the lessons do not.
        </p>
      ) : null}

      <div className="mt-8 space-y-6">
        {tool.whatItIs ? (
          <Section title="What it is">
            <p>{tool.whatItIs}</p>
          </Section>
        ) : null}

        {tool.whyAscendUsesIt ? (
          <Section title="Why Ascend uses it">
            <p>{tool.whyAscendUsesIt}</p>
          </Section>
        ) : null}

        {tool.whenToUseIt || tool.whenNotToUseIt ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {tool.whenToUseIt ? (
              <Card>
                <CardHeader title="When to use it" />
                <CardBody>
                  <ul className="space-y-2">
                    {tool.whenToUseIt.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <CheckCircle2
                          className="mt-0.5 size-3.5 shrink-0 text-success"
                          aria-hidden
                        />
                        <span className="min-w-0 text-muted-foreground text-pretty">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ) : null}

            {tool.whenNotToUseIt ? (
              <Card>
                <CardHeader title="When not to" />
                <CardBody>
                  <ul className="space-y-2">
                    {tool.whenNotToUseIt.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <XCircle
                          className="mt-0.5 size-3.5 shrink-0 text-destructive"
                          aria-hidden
                        />
                        <span className="min-w-0 text-muted-foreground text-pretty">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ) : null}
          </div>
        ) : null}

        {tool.coreFeatures ? (
          <Section title="Core features">
            <ul className="space-y-1.5">
              {tool.coreFeatures.map((item) => (
                <li key={item} className="text-sm text-muted-foreground text-pretty">
                  • {item}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {tool.terminology ? (
          <Section title="Terminology">
            <dl className="space-y-3">
              {tool.terminology.map((entry) => (
                <div key={entry.term}>
                  <dt className="text-sm font-medium">{entry.term}</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground text-pretty">
                    {entry.definition}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>
        ) : null}

        {tool.beginnerTutorial ? (
          <Section title="Beginner tutorial">
            <ol className="space-y-2">
              {tool.beginnerTutorial.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 font-mono text-xs">
                    {index + 1}
                  </span>
                  <span className="min-w-0 text-muted-foreground text-pretty">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        ) : null}

        {tool.practicalExercise ? (
          <Card elevated>
            <CardHeader title="Practical exercise" />
            <CardBody>
              <p className="text-sm text-muted-foreground text-pretty">
                {tool.practicalExercise}
              </p>
            </CardBody>
          </Card>
        ) : null}

        {tool.commonMistakes ? (
          <Section title="Common mistakes">
            <ul className="space-y-4">
              {tool.commonMistakes.map((item) => (
                <li key={item.mistake}>
                  <p className="flex items-start gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 text-pretty">{item.mistake}</span>
                  </p>
                  <p className="mt-1 ml-5.5 text-sm text-muted-foreground text-pretty">
                    {item.correction}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {tool.securityConsiderations ? (
          <Card className="border-destructive/30">
            <div className="flex items-center gap-2 border-b border-destructive/25 bg-destructive-muted px-5 py-2.5">
              <ShieldAlert className="size-4 shrink-0 text-destructive" aria-hidden />
              <h2 className="text-sm font-semibold text-destructive">
                Security considerations
              </h2>
            </div>
            <CardBody>
              <ul className="space-y-2">
                {tool.securityConsiderations.map((item) => (
                  <li key={item} className="text-sm text-muted-foreground text-pretty">
                    • {item}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {tool.costConsiderations ? (
          <Card>
            <div className="flex items-center gap-2 border-b border-border px-5 py-2.5">
              <Wallet className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <h2 className="text-sm font-semibold">Cost</h2>
            </div>
            <CardBody>
              <p className="text-sm text-muted-foreground text-pretty">
                {tool.costConsiderations}
              </p>
            </CardBody>
          </Card>
        ) : null}

        {tool.ascendUseCase ? (
          <Card className="border-primary/25">
            <div className="border-b border-primary/20 bg-primary-muted px-5 py-2.5">
              <h2 className="text-sm font-semibold text-primary">Ascend use case</h2>
            </div>
            <CardBody>
              <p className="text-sm text-muted-foreground text-pretty">
                {tool.ascendUseCase}
              </p>
            </CardBody>
          </Card>
        ) : null}

        {tool.masteryChecklist ? (
          <Section
            title="Mastery checklist"
            description="You know this tool when every line is true without hesitating."
          >
            <ul className="space-y-2">
              {tool.masteryChecklist.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-subtle-foreground"
                  />
                  <span className="min-w-0 text-muted-foreground text-pretty">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="space-y-2 text-sm text-muted-foreground [&>p]:text-pretty">
        {children}
      </CardBody>
    </Card>
  );
}
