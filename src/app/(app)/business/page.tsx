import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  CapacityCalculator,
  ClientProfitability,
  HiringTriggerCalculator,
  PackageEconomicsSection,
  ProjectEstimator,
} from "@/components/business/calculators";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { USAGE_COST_POLICY } from "@/lib/domain/pricing";
import { getSettings } from "@/lib/queries/settings";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Business Lab" };

const SECTIONS = [
  { href: "#margins", label: "Package economics" },
  { href: "#profitability", label: "Client profitability" },
  { href: "#estimator", label: "Project estimator" },
  { href: "#capacity", label: "Capacity" },
  { href: "#hiring", label: "Hiring trigger" },
];

export default async function BusinessLabPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const settings = await getSettings(user);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Ascend Business Lab"
        description="Tools for deciding what to charge and when to hire, running on Ascend's real numbers. Every figure here reads the packages in Settings — nothing holds its own copy."
      />

      {settings.error ? (
        <ErrorState className="mt-6" description={settings.error} />
      ) : null}

      <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-2">
        {SECTIONS.map((section) => (
          <a
            key={section.href}
            href={section.href}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <div className="mt-8 space-y-6">
        <PackageEconomicsSection
          packages={settings.packages}
          currency={settings.currency}
        />
        <ClientProfitability
          packages={settings.packages}
          currency={settings.currency}
        />
        <ProjectEstimator
          packages={settings.packages}
          currency={settings.currency}
        />
        <CapacityCalculator
          packages={settings.packages}
          deliverableHoursPerWeek={settings.deliverableHoursPerWeek}
        />
        <HiringTriggerCalculator currency={settings.currency} />
      </div>

      <p className="mt-8 rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-xs text-muted-foreground text-pretty">
        <strong className="text-foreground">Usage costs.</strong> {USAGE_COST_POLICY}
      </p>
    </div>
  );
}
