"use client";

import { useState } from "react";

import { PackageEconomicsPanel } from "@/components/business/package-economics";
import { Card, CardBody, CardHeader } from "@/components/common/card";
import { StatusPill } from "@/components/common/status-pill";
import { Field, Input } from "@/components/ui/field";
import {
  capacity,
  cac,
  estimateProject,
  expectedLifetimeMonths,
  formatCurrency,
  formatPercent,
  hiringTrigger,
  lifetimeMargin,
  ltv,
  ltvToCacRatio,
  monthlyMargin,
  packageEconomics,
  priceLabel,
  recurringClientCapacity,
  setupMargin,
  dollarsToCents,
  centsToDollars,
} from "@/lib/engines/finance";
import type { PackageRow } from "@/lib/queries/settings";
import { cn } from "@/lib/utils";

/**
 * Business Lab calculators.
 *
 * Every one reads Ascend's live packages from Settings — none holds its own
 * numbers. Change a price there and every figure on this page moves, which is
 * the whole point: these are tools for deciding what to charge, not exercises
 * about a fictional company.
 */

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  description,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  description?: string;
  suffix?: string;
}) {
  return (
    <Field label={label} description={description}>
      {(props) => (
        <div className="flex items-center gap-2">
          <Input
            {...props}
            type="number"
            step={step}
            min={min}
            value={Number.isFinite(value) ? value : 0}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          {suffix ? (
            <span className="shrink-0 text-xs text-subtle-foreground">{suffix}</span>
          ) : null}
        </div>
      )}
    </Field>
  );
}

function Readout({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "warn";
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 font-mono text-sm tabular-nums",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
          tone === "warn" && "text-warning",
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-xs text-subtle-foreground text-pretty">{hint}</div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function PackageEconomicsSection({
  packages,
  currency,
}: {
  packages: PackageRow[];
  currency: string;
}) {
  const [selected, setSelected] = useState(packages[0]?.id ?? "");
  const pkg = packages.find((p) => p.id === selected) ?? packages[0];

  if (!pkg) {
    return (
      <Card>
        <CardHeader title="Package economics" />
        <CardBody>
          <p className="text-sm text-muted-foreground">
            No packages yet. They are created when the database is connected.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card id="margins">
      <CardHeader
        title="Package economics"
        description="Live from Settings. Setup, recurring, annual recurring and first year — revenue, every cost category, hours, effective hourly rates, gross profit and margin."
        action={
          <div className="flex gap-1.5">
            {packages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  p.id === pkg.id
                    ? "border-primary/40 bg-primary-muted text-primary"
                    : "border-border text-muted-foreground hover:bg-surface-2",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        }
      />
      <CardBody className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {priceLabel(pkg, pkg.setupPriceCents, { currency })} setup ·{" "}
          {priceLabel(pkg, pkg.monthlyPriceCents, { currency })} per month
          {pkg.isFromPricing ? " — quoted as a floor, never a flat rate" : ""}
        </p>
        <PackageEconomicsPanel economics={packageEconomics(pkg)} currency={currency} />
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function ClientProfitability({
  packages,
  currency,
}: {
  packages: PackageRow[];
  currency: string;
}) {
  const [selected, setSelected] = useState(packages[0]?.id ?? "");
  const [months, setMonths] = useState(18);
  const [churn, setChurn] = useState(5);
  const [acquisitionSpend, setAcquisitionSpend] = useState(0);

  const pkg = packages.find((p) => p.id === selected) ?? packages[0];
  if (!pkg) return null;

  const setup = setupMargin(pkg);
  const monthly = monthlyMargin(pkg);
  const lifetime = lifetimeMargin(pkg, months);
  const churnRate = churn / 100;

  const lifetimeValue = ltv({
    monthlyGrossProfitCents: monthly.grossProfitCents,
    monthlyChurnRate: churnRate,
    setupGrossProfitCents: setup.grossProfitCents,
  });
  const acquisitionCost = cac({
    salesAndMarketingSpendCents: dollarsToCents(acquisitionSpend),
    clientsAcquired: 1,
  });
  const ratio = ltvToCacRatio(lifetimeValue, acquisitionCost);
  const expectedMonths = expectedLifetimeMonths(churnRate);

  return (
    <Card id="profitability">
      <CardHeader
        title="Client profitability"
        description="What one client of this package is actually worth, on a gross-profit basis. Revenue-based lifetime value flatters every agency."
        action={
          <div className="flex gap-1.5">
            {packages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  p.id === pkg.id
                    ? "border-primary/40 bg-primary-muted text-primary"
                    : "border-border text-muted-foreground hover:bg-surface-2",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        }
      />
      <CardBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            label="Client lifetime"
            value={months}
            onChange={setMonths}
            min={1}
            suffix="months"
          />
          <NumberField
            label="Monthly churn"
            value={churn}
            onChange={setChurn}
            step={0.5}
            suffix="%"
            description="5% ≈ a 20-month average life."
          />
          <NumberField
            label="Cost to acquire one client"
            value={acquisitionSpend}
            onChange={setAcquisitionSpend}
            suffix={currency}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Readout
            label={`Gross profit over ${months} months`}
            value={formatCurrency(lifetime.grossProfitCents, { currency })}
            tone={lifetime.grossProfitCents > 0 ? "good" : "bad"}
          />
          <Readout
            label="Gross margin"
            value={formatPercent(lifetime.grossMargin)}
            tone={
              lifetime.grossMargin !== null && lifetime.grossMargin >= 0.5
                ? "good"
                : "warn"
            }
          />
          <Readout
            label="LTV (gross profit)"
            value={
              lifetimeValue === null
                ? "unbounded"
                : formatCurrency(lifetimeValue, { currency })
            }
            hint={
              expectedMonths === null
                ? "Zero churn means unbounded — set a churn rate."
                : `At ${churn}% churn, ~${Math.round(expectedMonths)} months average`
            }
          />
          <Readout
            label="LTV : CAC"
            value={ratio === null ? "—" : `${ratio.toFixed(1)}×`}
            tone={ratio === null ? undefined : ratio >= 3 ? "good" : "warn"}
            hint={
              ratio === null
                ? "Enter an acquisition cost"
                : ratio >= 3
                  ? "Healthy — 3× or better"
                  : "Below 3×. Acquisition is eating the margin."
            }
          />
        </div>
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function ProjectEstimator({
  packages,
  currency,
}: {
  packages: PackageRow[];
  currency: string;
}) {
  const defaultRate = centsToDollars(packages[0]?.labourRateCentsPerHour ?? 6000);
  const [tasks, setTasks] = useState("8, 12, 6, 4, 5");
  const [uncertainty, setUncertainty] = useState(25);
  const [rate, setRate] = useState(defaultRate);
  const [software, setSoftware] = useState(0);
  const [quote, setQuote] = useState(6000);

  const taskHours = tasks
    .split(",")
    .map((t) => Number(t.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const result = estimateProject({
    taskHours,
    uncertainty: uncertainty / 100,
    labourRateCentsPerHour: dollarsToCents(rate),
    softwareCostCents: dollarsToCents(software),
    quotedPriceCents: dollarsToCents(quote),
  });

  return (
    <Card id="estimator">
      <CardHeader
        title="Project estimator"
        description="Break the work into tasks, add contingency for what you do not yet know, and see what the quote actually earns per hour."
      />
      <CardBody className="space-y-5">
        <Field
          label="Task estimates"
          description="Hours per task, comma separated. More tasks means fewer hidden ones."
        >
          {(props) => (
            <Input
              {...props}
              value={tasks}
              onChange={(e) => setTasks(e.target.value)}
              placeholder="8, 12, 6, 4"
            />
          )}
        </Field>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            label="Uncertainty"
            value={uncertainty}
            onChange={setUncertainty}
            step={5}
            suffix="%"
          />
          <NumberField
            label="Labour cost per hour"
            value={rate}
            onChange={setRate}
            suffix={currency}
          />
          <NumberField
            label="Software cost"
            value={software}
            onChange={setSoftware}
            suffix={currency}
          />
          <NumberField
            label="Quoted price"
            value={quote}
            onChange={setQuote}
            suffix={currency}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Readout label="Base hours" value={`${result.baseHours}h`} />
          <Readout
            label="With contingency"
            value={`${result.totalHours}h`}
            hint={`+${result.contingencyHours}h buffer`}
          />
          <Readout
            label="Gross profit"
            value={formatCurrency(result.margin.grossProfitCents, { currency })}
            tone={result.margin.grossProfitCents > 0 ? "good" : "bad"}
          />
          <Readout
            label="Effective hourly"
            value={
              result.effectiveHourlyRateCents === null
                ? "—"
                : `${formatCurrency(result.effectiveHourlyRateCents, { currency })}/h`
            }
            hint={formatPercent(result.margin.grossMargin) + " gross margin"}
          />
        </div>

        {result.warnings.length > 0 ? (
          <ul className="space-y-2">
            {result.warnings.map((warning) => (
              <li
                key={warning}
                className="rounded-lg border border-warning/25 bg-warning-muted px-3 py-2 text-xs text-muted-foreground text-pretty"
              >
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function CapacityCalculator({
  packages,
  deliverableHoursPerWeek,
}: {
  packages: PackageRow[];
  deliverableHoursPerWeek: number;
}) {
  const [total, setTotal] = useState(deliverableHoursPerWeek);
  const [recurring, setRecurring] = useState(0);
  const [project, setProject] = useState(0);

  const result = capacity({
    deliverableHoursPerWeek: total,
    committedRecurringHoursPerWeek: recurring,
    committedProjectHoursPerWeek: project,
  });

  const tone =
    result.status === "over-capacity"
      ? "bad"
      : result.status === "tight"
        ? "warn"
        : result.status === "healthy"
          ? "good"
          : undefined;

  return (
    <Card id="capacity">
      <CardHeader
        title="Capacity"
        description="Delivery hours only — not admin, not sales, not the hours you wish you had."
      />
      <CardBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            label="Deliverable hours per week"
            value={total}
            onChange={setTotal}
            suffix="h"
          />
          <NumberField
            label="Committed to recurring clients"
            value={recurring}
            onChange={setRecurring}
            suffix="h"
          />
          <NumberField
            label="Committed to project work"
            value={project}
            onChange={setProject}
            suffix="h"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Readout
            label="Utilisation"
            value={formatPercent(result.utilisation)}
            tone={tone}
          />
          <Readout
            label="Free hours"
            value={`${result.freeHours}h`}
            tone={result.freeHours < 0 ? "bad" : undefined}
          />
          <Readout
            label="Status"
            value={result.status.replace("-", " ")}
            tone={tone}
          />
        </div>

        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-muted-foreground text-pretty">
          {result.advice}
        </p>

        {result.freeHours > 0 && packages.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium">
              Room for how many more recurring clients
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {packages.map((pkg) => {
                const count = recurringClientCapacity({
                  freeHoursPerWeek: result.freeHours,
                  monthlyHoursPerClient: pkg.monthlyHours,
                });
                return (
                  <Readout
                    key={pkg.id}
                    label={pkg.name}
                    value={count === null ? "—" : `${count} clients`}
                    hint={`${pkg.monthlyHours}h per client per month`}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function HiringTriggerCalculator({ currency }: { currency: string }) {
  const [utilisation, setUtilisation] = useState(80);
  const [weeks, setWeeks] = useState(4);
  const [grossProfit, setGrossProfit] = useState(0);
  const [hireCost, setHireCost] = useState(5000);
  const [documented, setDocumented] = useState(false);

  const result = hiringTrigger({
    deliverableHoursPerWeek: 30,
    committedRecurringHoursPerWeek: 0,
    committedProjectHoursPerWeek: 0,
    sustainedUtilisation: utilisation / 100,
    sustainedWeeks: weeks,
    monthlyGrossProfitCents: dollarsToCents(grossProfit),
    proposedHireMonthlyCostCents: dollarsToCents(hireCost),
    hasDocumentedSops: documented,
  });

  return (
    <Card id="hiring">
      <CardHeader
        title="Hiring trigger"
        description="Four independent questions. Agencies get into trouble by answering only the first."
        action={
          <StatusPill tone={result.shouldHire ? "success" : "neutral"}>
            {result.shouldHire ? "Conditions met" : "Not yet"}
          </StatusPill>
        }
      />
      <CardBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            label="Sustained utilisation"
            value={utilisation}
            onChange={setUtilisation}
            step={5}
            suffix="%"
          />
          <NumberField
            label="Weeks at that level"
            value={weeks}
            onChange={setWeeks}
            suffix="wk"
          />
          <NumberField
            label="Monthly gross profit"
            value={grossProfit}
            onChange={setGrossProfit}
            suffix={currency}
          />
          <NumberField
            label="Hire's monthly cost"
            value={hireCost}
            onChange={setHireCost}
            suffix={currency}
          />
        </div>

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={documented}
            onChange={(e) => setDocumented(e.target.checked)}
            className="mt-0.5 size-4 rounded border-border accent-[var(--primary)]"
          />
          <span className="min-w-0 text-muted-foreground">
            The work being delegated is documented. Delegating undocumented work
            transfers the task but keeps the bottleneck.
          </span>
        </label>

        <ul className="space-y-2">
          {result.conditions.map((condition) => (
            <li
              key={condition.label}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                condition.met
                  ? "border-success/25 bg-success-muted"
                  : "border-border",
              )}
            >
              <p className="text-sm font-medium">
                {condition.met ? "✓" : "○"} {condition.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
                {condition.detail}
              </p>
            </li>
          ))}
        </ul>

        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-muted-foreground text-pretty">
          {result.recommendation}
        </p>
      </CardBody>
    </Card>
  );
}
