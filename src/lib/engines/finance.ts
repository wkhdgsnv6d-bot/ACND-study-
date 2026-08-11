/**
 * Finance engine.
 *
 * Every margin, pricing and capacity calculation in the platform routes through
 * here — the Business Lab calculators, the client-profitability view, and the
 * worked exercises inside lessons. Nothing anywhere hard-codes a package price:
 * callers load Ascend's packages from Settings and pass them in, so updating a
 * price in one place updates every exercise and simulation that references it.
 *
 * All money is handled in whole cents to avoid float drift, and exposed in
 * dollars at the edges.
 */

export type PackageTier = "essential" | "growth" | "partner";

/**
 * How third-party and usage-based costs are handled — AI and API usage, voice
 * minutes, phone numbers, SMS, CRM licences, domains, premium plugins and
 * subscriptions.
 *
 * This matters more than it looks. Usage costs scale with the client's activity
 * and Ascend does not control them, so absorbing them silently is how a healthy
 * margin quietly becomes a loss on the client who succeeds most.
 */
export type UsageBilling =
  /** Billed to the client separately, or paid by them directly. Excluded from Ascend's margin. */
  | "separate"
  /** A defined monthly allowance is included; usage beyond it is billed on. */
  | "allowance"
  /** Absorbed entirely into the monthly fee. */
  | "included";

export interface ServicePackage {
  tier: PackageTier;
  name: string;

  /* -- Customer-facing pricing -- */
  /** One-off setup fee, in cents. */
  setupPriceCents: number;
  /** Recurring monthly fee, in cents. */
  monthlyPriceCents: number;
  /**
   * Whether this is "from" pricing. Growth and Partner are quoted as a floor,
   * not a fixed price, and the platform must never present them as a flat rate.
   */
  isFromPricing: boolean;

  /* -- Internal planning assumptions (editable, not customer-facing) -- */
  /** Third-party software cost to deliver this package per month, in cents. */
  monthlySoftwareCostCents: number;
  /** One-off software/setup cost, in cents. */
  setupSoftwareCostCents: number;
  /** Estimated delivery hours for the initial build. */
  setupHours: number;
  /** Estimated hours per month to maintain it. */
  monthlyHours: number;
  /** What an hour of delivery labour costs Ascend, in cents. */
  labourRateCentsPerHour: number;

  /* -- Third-party and usage-based costs -- */
  usageBilling: UsageBilling;
  /** Expected monthly usage cost, in cents. Used for modelling regardless of billing treatment. */
  estimatedMonthlyUsageCostCents: number;
  /** Monthly usage covered by the fee when `usageBilling` is `allowance`, in cents. */
  usageAllowanceCents: number;

  /**
   * False until the planning assumptions above have actually been reviewed
   * against delivery data. Seeded values are estimates, and the UI says so.
   */
  assumptionsReviewed: boolean;
}

/* ------------------------------------------------------------------ */
/* Core margin                                                         */
/* ------------------------------------------------------------------ */

export interface MarginResult {
  revenueCents: number;
  costCents: number;
  grossProfitCents: number;
  /** 0–1. Null when revenue is zero, because the ratio is undefined. */
  grossMargin: number | null;
  breakdown: {
    labourCostCents: number;
    softwareCostCents: number;
    usageCostCents: number;
  };
}

function buildMargin(
  revenueCents: number,
  labourCostCents: number,
  softwareCostCents: number,
  usageCostCents = 0,
): MarginResult {
  const costCents = labourCostCents + softwareCostCents + usageCostCents;
  const grossProfitCents = revenueCents - costCents;
  return {
    revenueCents,
    costCents,
    grossProfitCents,
    grossMargin: revenueCents === 0 ? null : grossProfitCents / revenueCents,
    breakdown: { labourCostCents, softwareCostCents, usageCostCents },
  };
}

/**
 * The share of estimated usage cost that Ascend actually absorbs.
 *
 * - `separate`: none — it is billed on or paid direct, so it belongs in neither
 *   Ascend's revenue nor its costs.
 * - `allowance`: up to the allowance. Overage is billed on, so it nets out.
 * - `included`: all of it.
 */
export function absorbedUsageCostCents(pkg: ServicePackage): number {
  switch (pkg.usageBilling) {
    case "separate":
      return 0;
    case "allowance":
      return Math.min(pkg.estimatedMonthlyUsageCostCents, pkg.usageAllowanceCents);
    case "included":
      return pkg.estimatedMonthlyUsageCostCents;
  }
}

/** Usage cost that passes through to the client rather than hitting margin. */
export function passThroughUsageCostCents(pkg: ServicePackage): number {
  return Math.max(
    0,
    pkg.estimatedMonthlyUsageCostCents - absorbedUsageCostCents(pkg),
  );
}

export function setupMargin(pkg: ServicePackage): MarginResult {
  return buildMargin(
    pkg.setupPriceCents,
    pkg.setupHours * pkg.labourRateCentsPerHour,
    pkg.setupSoftwareCostCents,
  );
}

export function monthlyMargin(pkg: ServicePackage): MarginResult {
  return buildMargin(
    pkg.monthlyPriceCents,
    pkg.monthlyHours * pkg.labourRateCentsPerHour,
    pkg.monthlySoftwareCostCents,
    absorbedUsageCostCents(pkg),
  );
}

/**
 * Total economics over a given client lifetime. This is the number that decides
 * whether a package is worth selling — a thin setup margin is fine if the
 * recurring tail is healthy, and vice versa.
 */
export function lifetimeMargin(
  pkg: ServicePackage,
  lifetimeMonths: number,
): MarginResult {
  const setup = setupMargin(pkg);
  const monthly = monthlyMargin(pkg);
  return buildMargin(
    setup.revenueCents + monthly.revenueCents * lifetimeMonths,
    setup.breakdown.labourCostCents + monthly.breakdown.labourCostCents * lifetimeMonths,
    setup.breakdown.softwareCostCents +
      monthly.breakdown.softwareCostCents * lifetimeMonths,
    monthly.breakdown.usageCostCents * lifetimeMonths,
  );
}

/* ------------------------------------------------------------------ */
/* Full package economics                                              */
/* ------------------------------------------------------------------ */

export interface PhaseEconomics {
  revenueCents: number;
  softwareCostCents: number;
  usageCostCents: number;
  labourCostCents: number;
  totalCostCents: number;
  hours: number;
  grossProfitCents: number;
  grossMargin: number | null;
  /** Revenue per delivery hour — what an hour of your time actually earns. */
  effectiveHourlyRevenueCents: number | null;
  /** Gross profit per delivery hour, which is the more honest version. */
  effectiveHourlyProfitCents: number | null;
}

export interface PackageEconomics {
  tier: PackageTier;
  name: string;
  isFromPricing: boolean;
  assumptionsReviewed: boolean;

  /** One-off build. */
  setup: PhaseEconomics;
  /** A single recurring month. */
  monthly: PhaseEconomics;
  /** Twelve recurring months — ARR and annual recurring gross profit. */
  annualRecurring: PhaseEconomics;
  /** Setup plus twelve recurring months, the realistic first-year picture. */
  firstYear: PhaseEconomics;

  /** Usage cost billed on to the client rather than absorbed, per month. */
  passThroughUsageCentsPerMonth: number;
  usageBilling: UsageBilling;

  warnings: string[];
}

function phase(options: {
  revenueCents: number;
  softwareCostCents: number;
  usageCostCents: number;
  hours: number;
  labourRateCentsPerHour: number;
}): PhaseEconomics {
  const labourCostCents = options.hours * options.labourRateCentsPerHour;
  const totalCostCents =
    labourCostCents + options.softwareCostCents + options.usageCostCents;
  const grossProfitCents = options.revenueCents - totalCostCents;

  return {
    revenueCents: options.revenueCents,
    softwareCostCents: options.softwareCostCents,
    usageCostCents: options.usageCostCents,
    labourCostCents,
    totalCostCents,
    hours: options.hours,
    grossProfitCents,
    grossMargin: options.revenueCents === 0 ? null : grossProfitCents / options.revenueCents,
    effectiveHourlyRevenueCents:
      options.hours === 0 ? null : options.revenueCents / options.hours,
    effectiveHourlyProfitCents:
      options.hours === 0 ? null : grossProfitCents / options.hours,
  };
}

/**
 * The complete economic picture for one package: setup, recurring, annual
 * recurring and first year, each with revenue, every cost category, delivery
 * hours, effective hourly rates, gross profit and gross margin.
 *
 * Everything the Business Lab, the client-profitability view and the in-lesson
 * pricing exercises need comes from this one function, so those surfaces cannot
 * disagree with each other about what a package earns.
 */
export function packageEconomics(pkg: ServicePackage): PackageEconomics {
  const absorbedUsage = absorbedUsageCostCents(pkg);

  const setup = phase({
    revenueCents: pkg.setupPriceCents,
    softwareCostCents: pkg.setupSoftwareCostCents,
    usageCostCents: 0,
    hours: pkg.setupHours,
    labourRateCentsPerHour: pkg.labourRateCentsPerHour,
  });

  const monthly = phase({
    revenueCents: pkg.monthlyPriceCents,
    softwareCostCents: pkg.monthlySoftwareCostCents,
    usageCostCents: absorbedUsage,
    hours: pkg.monthlyHours,
    labourRateCentsPerHour: pkg.labourRateCentsPerHour,
  });

  const annualRecurring = phase({
    revenueCents: pkg.monthlyPriceCents * 12,
    softwareCostCents: pkg.monthlySoftwareCostCents * 12,
    usageCostCents: absorbedUsage * 12,
    hours: pkg.monthlyHours * 12,
    labourRateCentsPerHour: pkg.labourRateCentsPerHour,
  });

  const firstYear = phase({
    revenueCents: pkg.setupPriceCents + pkg.monthlyPriceCents * 12,
    softwareCostCents: pkg.setupSoftwareCostCents + pkg.monthlySoftwareCostCents * 12,
    usageCostCents: absorbedUsage * 12,
    hours: pkg.setupHours + pkg.monthlyHours * 12,
    labourRateCentsPerHour: pkg.labourRateCentsPerHour,
  });

  return {
    tier: pkg.tier,
    name: pkg.name,
    isFromPricing: pkg.isFromPricing,
    assumptionsReviewed: pkg.assumptionsReviewed,
    setup,
    monthly,
    annualRecurring,
    firstYear,
    passThroughUsageCentsPerMonth: passThroughUsageCostCents(pkg),
    usageBilling: pkg.usageBilling,
    warnings: packageWarnings(pkg, { setup, monthly, firstYear }),
  };
}

function packageWarnings(
  pkg: ServicePackage,
  phases: { setup: PhaseEconomics; monthly: PhaseEconomics; firstYear: PhaseEconomics },
): string[] {
  const warnings: string[] = [];

  if (phases.setup.grossProfitCents < 0) {
    warnings.push(
      "The setup fee does not cover the estimated delivery cost. Either the price is too low or the hours estimate is too high — find out which before quoting it.",
    );
  }
  if (phases.monthly.grossProfitCents < 0) {
    warnings.push(
      "The monthly fee loses money at these assumptions. Recurring revenue that costs more to service than it earns is worse than no recurring revenue.",
    );
  }
  if (
    phases.monthly.grossMargin !== null &&
    phases.monthly.grossMargin >= 0 &&
    phases.monthly.grossMargin < 0.5
  ) {
    warnings.push(
      "Recurring gross margin is below 50%. On a services business that leaves little for sales, admin and the months that go wrong.",
    );
  }
  if (
    phases.setup.grossMargin !== null &&
    phases.setup.grossMargin >= 0 &&
    phases.setup.grossMargin < 0.4
  ) {
    warnings.push(
      "Setup gross margin is below 40%. Project work carries the overrun risk, so it needs more headroom than recurring work, not less.",
    );
  }
  if (pkg.usageBilling === "included" && pkg.estimatedMonthlyUsageCostCents > 0) {
    warnings.push(
      "Usage costs are absorbed into the monthly fee. These scale with the client's activity and Ascend does not control them — the client who succeeds most will damage this margin the most.",
    );
  }
  if (
    pkg.usageBilling === "allowance" &&
    pkg.estimatedMonthlyUsageCostCents > pkg.usageAllowanceCents
  ) {
    warnings.push(
      "Expected usage already exceeds the included allowance, so overage billing will be the norm rather than the exception. Make sure the client understands that before they sign.",
    );
  }
  if (!pkg.assumptionsReviewed) {
    warnings.push(
      "Delivery hours and software costs are unreviewed estimates. Every figure here inherits that uncertainty until real delivery data replaces them.",
    );
  }

  return warnings;
}

/** Display label that respects "from" pricing rather than implying a flat rate. */
export function priceLabel(
  pkg: Pick<ServicePackage, "isFromPricing">,
  cents: number,
  options?: { currency?: string; locale?: string },
): string {
  const formatted = formatCurrency(cents, options);
  return pkg.isFromPricing ? `From ${formatted}` : formatted;
}

/* ------------------------------------------------------------------ */
/* Agency-level metrics                                                */
/* ------------------------------------------------------------------ */

/** Customer acquisition cost. Null when no clients were acquired. */
export function cac(options: {
  salesAndMarketingSpendCents: number;
  clientsAcquired: number;
}): number | null {
  if (options.clientsAcquired <= 0) return null;
  return options.salesAndMarketingSpendCents / options.clientsAcquired;
}

/**
 * Lifetime value on a gross-profit basis, which is the only version worth
 * comparing against CAC. Revenue-based LTV flatters every agency.
 */
export function ltv(options: {
  monthlyGrossProfitCents: number;
  /** 0–1 monthly churn. */
  monthlyChurnRate: number;
  setupGrossProfitCents?: number;
}): number | null {
  if (options.monthlyChurnRate <= 0) return null;
  const recurring = options.monthlyGrossProfitCents / options.monthlyChurnRate;
  return recurring + (options.setupGrossProfitCents ?? 0);
}

export function ltvToCacRatio(
  ltvCents: number | null,
  cacCents: number | null,
): number | null {
  if (ltvCents === null || cacCents === null || cacCents === 0) return null;
  return ltvCents / cacCents;
}

/** Average expected client lifetime in months, from monthly churn. */
export function expectedLifetimeMonths(monthlyChurnRate: number): number | null {
  if (monthlyChurnRate <= 0) return null;
  return 1 / monthlyChurnRate;
}

export function monthlyChurnRate(options: {
  clientsLostInMonth: number;
  clientsAtStartOfMonth: number;
}): number | null {
  if (options.clientsAtStartOfMonth <= 0) return null;
  return options.clientsLostInMonth / options.clientsAtStartOfMonth;
}

export function arr(mrrCents: number): number {
  return mrrCents * 12;
}

export interface MrrMovement {
  openingCents: number;
  newCents: number;
  expansionCents: number;
  contractionCents: number;
  churnedCents: number;
}

/** Closing MRR plus net revenue retention — the honest view of recurring health. */
export function mrrMovement(movement: MrrMovement): {
  closingCents: number;
  netNewCents: number;
  /** Retention of the opening cohort only, excluding new business. */
  netRevenueRetention: number | null;
} {
  const closingCents =
    movement.openingCents +
    movement.newCents +
    movement.expansionCents -
    movement.contractionCents -
    movement.churnedCents;

  const retained =
    movement.openingCents +
    movement.expansionCents -
    movement.contractionCents -
    movement.churnedCents;

  return {
    closingCents,
    netNewCents: closingCents - movement.openingCents,
    netRevenueRetention:
      movement.openingCents === 0 ? null : retained / movement.openingCents,
  };
}

/* ------------------------------------------------------------------ */
/* Capacity and hiring                                                 */
/* ------------------------------------------------------------------ */

export interface CapacityInput {
  /** Hours per week you can realistically give to delivery, not admin or sales. */
  deliverableHoursPerWeek: number;
  /** Hours per week already committed to existing recurring clients. */
  committedRecurringHoursPerWeek: number;
  /** Hours per week currently consumed by in-flight project work. */
  committedProjectHoursPerWeek: number;
}

export interface CapacityResult {
  totalHours: number;
  committedHours: number;
  freeHours: number;
  /** 0–1+. Above 1 means you are already over-committed. */
  utilisation: number;
  status: "underutilised" | "healthy" | "tight" | "over-capacity";
  /** Plain-language read on what to do about it. */
  advice: string;
}

export function capacity(input: CapacityInput): CapacityResult {
  const totalHours = input.deliverableHoursPerWeek;
  const committedHours =
    input.committedRecurringHoursPerWeek + input.committedProjectHoursPerWeek;
  const freeHours = totalHours - committedHours;
  const utilisation = totalHours === 0 ? 0 : committedHours / totalHours;

  let status: CapacityResult["status"];
  let advice: string;

  if (utilisation > 1) {
    status = "over-capacity";
    advice =
      "You are already promising more hours than you have. Something will slip — decide which, deliberately, before a client decides for you.";
  } else if (utilisation >= 0.85) {
    status = "tight";
    advice =
      "At this utilisation there is no slack for an incident or a sick day. Stop selling delivery hours, or start delegating them.";
  } else if (utilisation >= 0.5) {
    status = "healthy";
    advice = "Room to take on work and room to absorb a bad week.";
  } else {
    status = "underutilised";
    advice =
      "You have capacity. The constraint on Ascend right now is sales, not delivery.";
  }

  return { totalHours, committedHours, freeHours, utilisation, status, advice };
}

/**
 * How many more clients of a given package current capacity can carry, counting
 * only the recurring maintenance load.
 */
export function recurringClientCapacity(options: {
  freeHoursPerWeek: number;
  monthlyHoursPerClient: number;
}): number | null {
  if (options.monthlyHoursPerClient <= 0) return null;
  const freeHoursPerMonth = options.freeHoursPerWeek * (52 / 12);
  return Math.floor(freeHoursPerMonth / options.monthlyHoursPerClient);
}

export interface HiringTriggerInput extends CapacityInput {
  /** 0–1 utilisation sustained over the recent period. */
  sustainedUtilisation: number;
  /** Weeks that utilisation has been sustained at that level. */
  sustainedWeeks: number;
  monthlyGrossProfitCents: number;
  /** Fully-loaded monthly cost of the hire being considered. */
  proposedHireMonthlyCostCents: number;
  /** Whether the work being delegated is documented well enough to hand over. */
  hasDocumentedSops: boolean;
}

export interface HiringTriggerResult {
  shouldHire: boolean;
  /** Each condition, so the UI can show exactly what is and isn't satisfied. */
  conditions: Array<{ label: string; met: boolean; detail: string }>;
  /** Months of the hire's cost covered by current gross profit. */
  affordabilityMonths: number | null;
  recommendation: string;
}

/**
 * A hiring decision is four independent questions, and agencies usually get
 * into trouble by answering only the first one.
 */
export function hiringTrigger(input: HiringTriggerInput): HiringTriggerResult {
  const utilisationMet = input.sustainedUtilisation >= 0.8;
  const durationMet = input.sustainedWeeks >= 6;
  const affordabilityMonths =
    input.proposedHireMonthlyCostCents === 0
      ? null
      : input.monthlyGrossProfitCents / input.proposedHireMonthlyCostCents;
  const affordabilityMet = (affordabilityMonths ?? 0) >= 2;
  const documentationMet = input.hasDocumentedSops;

  const conditions = [
    {
      label: "Sustained utilisation at or above 80%",
      met: utilisationMet,
      detail: `Currently ${Math.round(input.sustainedUtilisation * 100)}%.`,
    },
    {
      label: "Sustained for at least 6 weeks",
      met: durationMet,
      detail: `${input.sustainedWeeks} weeks so far. One busy fortnight is not a trend.`,
    },
    {
      label: "Gross profit covers at least 2× the hire's cost",
      met: affordabilityMet,
      detail:
        affordabilityMonths === null
          ? "No cost entered for the proposed hire."
          : `Current gross profit covers ${affordabilityMonths.toFixed(1)}× the monthly cost.`,
    },
    {
      label: "The work is documented before it is delegated",
      met: documentationMet,
      detail: documentationMet
        ? "SOPs exist for the work being handed over."
        : "Delegating undocumented work transfers the task but keeps the bottleneck.",
    },
  ];

  const shouldHire = conditions.every((c) => c.met);

  return {
    shouldHire,
    conditions,
    affordabilityMonths,
    recommendation: shouldHire
      ? "The conditions for a first hire are met. Write the scorecard before writing the job ad."
      : (conditions.find((c) => !c.met)?.detail ??
        "Not yet — one or more conditions are unmet."),
  };
}

/* ------------------------------------------------------------------ */
/* Project estimation                                                  */
/* ------------------------------------------------------------------ */

export interface ProjectEstimateInput {
  /** Task-level hour estimates before any adjustment. */
  taskHours: number[];
  /** 0–1. How much unknown remains — drives the contingency buffer. */
  uncertainty: number;
  labourRateCentsPerHour: number;
  softwareCostCents: number;
  /** The price you intend to quote, in cents. */
  quotedPriceCents: number;
}

export interface ProjectEstimateResult {
  baseHours: number;
  contingencyHours: number;
  totalHours: number;
  costCents: number;
  margin: MarginResult;
  /** Effective hourly rate you would actually earn at the quoted price. */
  effectiveHourlyRateCents: number | null;
  warnings: string[];
}

export function estimateProject(input: ProjectEstimateInput): ProjectEstimateResult {
  const baseHours = input.taskHours.reduce((sum, h) => sum + h, 0);
  const contingencyHours = baseHours * clamp(input.uncertainty, 0, 1);
  const totalHours = baseHours + contingencyHours;
  const labourCost = totalHours * input.labourRateCentsPerHour;
  const margin = buildMargin(input.quotedPriceCents, labourCost, input.softwareCostCents);

  const warnings: string[] = [];
  if (margin.grossMargin !== null && margin.grossMargin < 0.5) {
    warnings.push(
      "Gross margin below 50%. On a services business this leaves nothing for sales, admin or the projects that go wrong.",
    );
  }
  if (margin.grossProfitCents < 0) {
    warnings.push("This quote loses money before you have written a line of code.");
  }
  if (input.uncertainty >= 0.4) {
    warnings.push(
      "Uncertainty this high usually means the scope is not yet understood. Consider a paid discovery phase instead of a fixed quote.",
    );
  }
  if (input.taskHours.length < 3) {
    warnings.push(
      "Estimating from fewer than three tasks tends to hide work. Break the project down further.",
    );
  }

  return {
    baseHours,
    contingencyHours,
    totalHours,
    costCents: margin.costCents,
    margin,
    effectiveHourlyRateCents:
      totalHours === 0 ? null : input.quotedPriceCents / totalHours,
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function formatCurrency(
  cents: number,
  options: { currency?: string; locale?: string; maximumFractionDigits?: number } = {},
): string {
  const { currency = "AUD", locale = "en-AU", maximumFractionDigits = 0 } = options;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(centsToDollars(cents));
}

export function formatPercent(value: number | null, fractionDigits = 0): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function formatHours(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
