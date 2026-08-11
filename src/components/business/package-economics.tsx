import { AlertTriangle } from "lucide-react";

import {
  formatCurrency,
  formatHours,
  formatPercent,
  type PackageEconomics,
  type PhaseEconomics,
  type UsageBilling,
} from "@/lib/engines/finance";
import { cn } from "@/lib/utils";

/**
 * The full economic picture for one package.
 *
 * Every figure comes from `packageEconomics()`, so this display cannot disagree
 * with the Business Lab calculators or the worked exercises inside lessons —
 * they all call the same function against the same rows from Settings.
 */

const USAGE_LABELS: Record<UsageBilling, string> = {
  separate: "Billed separately",
  allowance: "Included up to an allowance",
  included: "Absorbed into the monthly fee",
};

export function PackageEconomicsPanel({
  economics,
  currency,
  className,
}: {
  economics: PackageEconomics;
  currency: string;
  className?: string;
}) {
  const money = (cents: number) => formatCurrency(cents, { currency });

  return (
    <div className={cn("space-y-4", className)}>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">
            {economics.name} economics: setup, monthly recurring, annual recurring
            and first year
          </caption>
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left">
              <th scope="col" className="px-3 py-2 font-medium">
                Metric
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Setup
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Monthly
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Annual recurring
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                First year
              </th>
            </tr>
          </thead>
          <tbody className="[&_td]:px-3 [&_td]:py-1.5 [&_th]:px-3 [&_th]:py-1.5">
            <Row
              label="Revenue"
              economics={economics}
              pick={(p) => money(p.revenueCents)}
              emphasis
            />
            <Row
              label="Software cost"
              economics={economics}
              pick={(p) => (p.softwareCostCents ? `−${money(p.softwareCostCents)}` : "—")}
              muted
            />
            <Row
              label="Usage cost absorbed"
              economics={economics}
              pick={(p) => (p.usageCostCents ? `−${money(p.usageCostCents)}` : "—")}
              muted
            />
            <Row
              label="Labour cost"
              economics={economics}
              pick={(p) => (p.labourCostCents ? `−${money(p.labourCostCents)}` : "—")}
              muted
            />
            <Row
              label="Delivery hours"
              economics={economics}
              pick={(p) => (p.hours ? formatHours(p.hours) : "—")}
              muted
            />
            <Row
              label="Effective hourly revenue"
              economics={economics}
              pick={(p) =>
                p.effectiveHourlyRevenueCents === null
                  ? "—"
                  : `${money(p.effectiveHourlyRevenueCents)}/h`
              }
            />
            <Row
              label="Gross profit"
              economics={economics}
              pick={(p) => money(p.grossProfitCents)}
              emphasis
              tone={(p) => (p.grossProfitCents < 0 ? "bad" : "good")}
            />
            <Row
              label="Gross margin"
              economics={economics}
              pick={(p) => formatPercent(p.grossMargin)}
              emphasis
              tone={(p) =>
                p.grossMargin === null ? "none" : p.grossMargin >= 0.5 ? "good" : "warn"
              }
            />
          </tbody>
        </table>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <Summary
          label="Annual recurring revenue"
          value={money(economics.annualRecurring.revenueCents)}
        />
        <Summary
          label="Annual recurring gross profit"
          value={money(economics.annualRecurring.grossProfitCents)}
          tone={economics.annualRecurring.grossProfitCents < 0 ? "bad" : "good"}
        />
        <Summary
          label="Third-party & usage costs"
          value={USAGE_LABELS[economics.usageBilling]}
          hint={
            economics.passThroughUsageCentsPerMonth > 0
              ? `${money(economics.passThroughUsageCentsPerMonth)}/mo billed on`
              : undefined
          }
        />
      </dl>

      {economics.warnings.length > 0 ? (
        <ul className="space-y-2">
          {economics.warnings.map((warning) => (
            <li
              key={warning}
              className="flex items-start gap-2.5 rounded-lg border border-warning/25 bg-warning-muted px-3 py-2 text-xs"
            >
              <AlertTriangle
                className="mt-0.5 size-3.5 shrink-0 text-warning"
                aria-hidden
              />
              <span className="min-w-0 text-muted-foreground text-pretty">{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type Tone = "good" | "bad" | "warn" | "none";

function Row({
  label,
  economics,
  pick,
  emphasis = false,
  muted = false,
  tone,
}: {
  label: string;
  economics: PackageEconomics;
  pick: (phase: PhaseEconomics) => string;
  emphasis?: boolean;
  muted?: boolean;
  tone?: (phase: PhaseEconomics) => Tone;
}) {
  const phases: PhaseEconomics[] = [
    economics.setup,
    economics.monthly,
    economics.annualRecurring,
    economics.firstYear,
  ];

  return (
    <tr className="border-b border-border last:border-0">
      <th scope="row" className="text-left font-normal text-muted-foreground">
        {label}
      </th>
      {phases.map((phase, index) => (
        <td
          key={index}
          className={cn(
            "text-right font-mono tabular-nums",
            emphasis && "font-medium",
            muted && "text-subtle-foreground",
            toneClass(tone?.(phase)),
          )}
        >
          {pick(phase)}
        </td>
      ))}
    </tr>
  );
}

function toneClass(tone: Tone | undefined): string | undefined {
  switch (tone) {
    case "good":
      return "text-success";
    case "bad":
      return "text-destructive";
    case "warn":
      return "text-warning";
    default:
      return undefined;
  }
}

function Summary({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 font-mono text-sm tabular-nums",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </dd>
      {hint ? (
        <dd className="mt-0.5 text-xs text-subtle-foreground">{hint}</dd>
      ) : null}
    </div>
  );
}
