import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Award, CheckCircle2, Circle } from "lucide-react";

import { STATUS_TONE } from "@/app/(app)/certifications/page";
import { Card, CardBody, CardHeader } from "@/components/common/card";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { StatusPill } from "@/components/common/status-pill";
import { CERTIFICATIONS, CERTIFICATIONS_BY_KEY } from "@/lib/domain/certifications";
import {
  CERTIFICATION_STATUS_LABELS,
  type RequirementCategory,
} from "@/lib/engines/certification";
import { getProgressSnapshot } from "@/lib/queries/progress";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateStaticParams() {
  return CERTIFICATIONS.map((c) => ({ cert: c.key }));
}

export async function generateMetadata(
  props: PageProps<"/certifications/[cert]">,
): Promise<Metadata> {
  const { cert } = await props.params;
  return { title: CERTIFICATIONS_BY_KEY.get(cert)?.name ?? "Certification" };
}

const CATEGORY_LABELS: Record<RequirementCategory, string> = {
  knowledge: "Learn",
  practical: "Prove",
  exam: "Test",
  business: "Apply",
};

export default async function CertificationPage(
  props: PageProps<"/certifications/[cert]">,
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { cert: key } = await props.params;
  if (!CERTIFICATIONS_BY_KEY.has(key)) notFound();

  const snapshot = await getProgressSnapshot(user);
  const result = snapshot.certifications.find((c) => c.key === key);
  if (!result) notFound();

  const grouped = (["knowledge", "practical", "exam", "business"] as const)
    .map((category) => ({
      category,
      requirements: result.requirements.filter((r) => r.category === category),
    }))
    .filter((g) => g.requirements.length > 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href="/certifications"
          className="text-muted-foreground hover:text-foreground"
        >
          Certifications
        </Link>
        <span className="mx-2 text-subtle-foreground" aria-hidden>
          /
        </span>
        <span className="text-foreground">{result.definition.name}</span>
      </nav>

      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={STATUS_TONE[result.status]}>
              {CERTIFICATION_STATUS_LABELS[result.status]}
            </StatusPill>
            <StatusPill tone="neutral">Term {result.definition.term}</StatusPill>
          </div>
        }
        title={result.definition.name}
        description={result.definition.description}
      />

      <Card className="mt-8">
        <CardBody className="py-4">
          <div className="flex items-center gap-4">
            <Award
              className={
                result.status === "certified"
                  ? "size-8 shrink-0 text-success"
                  : "size-8 shrink-0 text-subtle-foreground"
              }
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-pretty">
                {result.definition.tagline}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <ProgressBar
                  className="flex-1"
                  label={`${result.definition.name} progress`}
                  value={result.progress}
                  tone={result.progress === 1 ? "success" : "primary"}
                />
                <span className="shrink-0 font-mono text-xs text-subtle-foreground tabular-nums">
                  {Math.round(result.progress * 100)}%
                </span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="mt-8 space-y-6">
        {grouped.map(({ category, requirements }) => (
          <Card key={category}>
            <CardHeader
              title={CATEGORY_LABELS[category]}
              description={`${requirements.filter((r) => r.met).length} of ${requirements.length} met`}
            />
            <CardBody>
              <ul className="space-y-4">
                {requirements.map((requirement, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">
                      {requirement.met ? (
                        <CheckCircle2 className="size-4 text-success" aria-hidden />
                      ) : (
                        <Circle className="size-4 text-subtle-foreground" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-pretty">
                        {requirement.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
                        {requirement.detail}
                      </p>
                      {!requirement.met && requirement.progress > 0 ? (
                        <ProgressBar
                          className="mt-2"
                          size="sm"
                          label={`${requirement.label} progress`}
                          value={requirement.progress}
                          tone="muted"
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="mt-8 rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-xs text-muted-foreground text-pretty">
        <strong className="text-foreground">On honesty.</strong> Practical evidence here
        is self-attested — there is no external examiner. What the platform guarantees is
        that skipping a requirement is a deliberate, recorded act rather than an accident:
        evidence links are required fields, rubric criteria are ticked one at a time, and
        whatever satisfied each requirement is stored against the claim.
      </p>
    </div>
  );
}
