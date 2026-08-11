import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Award } from "lucide-react";

import { Card, CardBody } from "@/components/common/card";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { ErrorState } from "@/components/common/states";
import { StatusPill, type PillTone } from "@/components/common/status-pill";
import {
  CERTIFICATION_STATUS_LABELS,
  type CertificationStatus,
} from "@/lib/engines/certification";
import { getProgressSnapshot } from "@/lib/queries/progress";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Certifications" };

export const STATUS_TONE: Record<CertificationStatus, PillTone> = {
  "not-started": "neutral",
  learning: "info",
  "practical-required": "warning",
  "exam-required": "warning",
  submitted: "info",
  passed: "success",
  "needs-improvement": "danger",
  certified: "success",
};

export default async function CertificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const snapshot = await getProgressSnapshot(user);
  const byTerm = [1, 2, 3, 4].map((term) => ({
    term,
    certs: snapshot.certifications.filter((c) => c.definition.term === term),
  }));

  const certified = snapshot.certifications.filter(
    (c) => c.status === "certified",
  ).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Certifications"
        description="Each one is a list of requirements evaluated against what you have actually done. There is no way to mark one complete — a certification exists only as the output of that evaluation."
      />

      {snapshot.error ? (
        <ErrorState className="mt-6" description={snapshot.error} />
      ) : null}

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Earned"
          value={`${certified}/${snapshot.certifications.length}`}
          tone={certified > 0 ? "success" : "muted"}
        />
        <StatCard
          label="In progress"
          value={
            snapshot.certifications.filter(
              (c) => c.progress > 0 && c.status !== "certified",
            ).length
          }
        />
        <StatCard
          label="Closest"
          value={
            snapshot.certifications
              .filter((c) => c.status !== "certified")
              .sort((a, b) => b.progress - a.progress)[0]
              ? `${Math.round(
                  (snapshot.certifications
                    .filter((c) => c.status !== "certified")
                    .sort((a, b) => b.progress - a.progress)[0]?.progress ?? 0) * 100,
                )}%`
              : "—"
          }
          hint={
            snapshot.certifications
              .filter((c) => c.status !== "certified")
              .sort((a, b) => b.progress - a.progress)[0]?.definition.name
          }
        />
      </section>

      {byTerm.map(({ term, certs }) =>
        certs.length === 0 ? null : (
          <section key={term} className="mt-10">
            <h2 className="mb-3 text-sm font-semibold tracking-tight">Term {term}</h2>
            <ul className="space-y-3">
              {certs.map((cert) => (
                <li key={cert.key}>
                  <Card>
                    <CardBody className="py-4">
                      <div className="flex items-start gap-3.5">
                        <Award
                          className={
                            cert.status === "certified"
                              ? "mt-0.5 size-5 shrink-0 text-success"
                              : "mt-0.5 size-5 shrink-0 text-subtle-foreground"
                          }
                          aria-hidden
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold tracking-tight">
                              {cert.definition.name}
                            </h3>
                            <StatusPill tone={STATUS_TONE[cert.status]}>
                              {CERTIFICATION_STATUS_LABELS[cert.status]}
                            </StatusPill>
                          </div>

                          <p className="mt-1 text-sm text-muted-foreground text-pretty">
                            {cert.definition.tagline}
                          </p>

                          {cert.nextAction ? (
                            <p className="mt-1.5 text-xs text-subtle-foreground text-pretty">
                              Next: {cert.nextAction}
                            </p>
                          ) : null}

                          <div className="mt-3 flex items-center gap-3">
                            <ProgressBar
                              className="flex-1"
                              size="sm"
                              label={`${cert.definition.name} progress`}
                              value={cert.progress}
                              tone={cert.progress === 1 ? "success" : "primary"}
                            />
                            <span className="shrink-0 font-mono text-xs text-subtle-foreground tabular-nums">
                              {Math.round(cert.progress * 100)}%
                            </span>
                          </div>
                        </div>

                        <Link
                          href={`/certifications/${cert.key}`}
                          className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary"
                          aria-label={`Open ${cert.definition.name}`}
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
        ),
      )}
    </div>
  );
}
