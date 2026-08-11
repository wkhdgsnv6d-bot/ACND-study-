import { dollarsToCents, type ServicePackage } from "@/lib/engines/finance";

/**
 * Ascend's service packages — the seed values for a new account.
 *
 * These are *defaults*, not constants. Nothing in the platform reads this file
 * at runtime except the one-time bootstrap that creates a new account's rows.
 * Every calculator, exercise and simulation loads the live rows from Settings,
 * so changing a price there changes every downstream figure.
 *
 * Two categories of number live here and they are not equally solid:
 *
 * - **Confirmed** — the customer-facing prices and the estimated monthly
 *   software cost and delivery time, as set by the founder.
 * - **Assumed** — monthly maintenance hours and the internal labour rate, which
 *   were never specified and are placeholders until real delivery data exists.
 *   Packages are seeded with `assumptionsReviewed: false`, which makes the UI
 *   say so and adds a warning to every economics readout.
 */

export interface PackageSeed extends Omit<ServicePackage, "assumptionsReviewed"> {
  description: string;
  /** Which figures came from the founder rather than from a default. */
  confirmedFields: Array<keyof ServicePackage>;
  /** Shown under the package in Settings. */
  positioningNote: string;
}

/**
 * Third-party and usage-based costs — AI and API usage, voice minutes, phone
 * numbers, SMS, CRM licences, domains, premium plugins and subscriptions — are
 * billed separately across every tier rather than absorbed. They scale with the
 * client's activity and Ascend does not control them.
 */
export const USAGE_COST_POLICY =
  "Third-party and usage-based costs — AI and API usage, voice minutes, phone numbers, SMS, CRM licences, domains, premium plugins and subscriptions — are billed separately or covered by a clearly defined usage allowance. They are never silently absorbed into the monthly fee.";

/** Internal labour rate assumption, in cents per hour. Not founder-supplied. */
const ASSUMED_LABOUR_RATE_CENTS = dollarsToCents(60);

export const PACKAGE_SEEDS: PackageSeed[] = [
  {
    tier: "essential",
    name: "Essential",
    description: "Website and core lead capture, kept live and working.",
    positioningNote:
      "Fixed price. The entry point — deliberately simple enough to scope on a single call.",
    setupPriceCents: dollarsToCents(1_500),
    monthlyPriceCents: dollarsToCents(149),
    isFromPricing: false,
    monthlySoftwareCostCents: dollarsToCents(35),
    setupSoftwareCostCents: 0,
    setupHours: 15,
    // Assumed. Roughly one hour a month of maintenance and small changes.
    monthlyHours: 1,
    labourRateCentsPerHour: ASSUMED_LABOUR_RATE_CENTS,
    usageBilling: "separate",
    estimatedMonthlyUsageCostCents: 0,
    usageAllowanceCents: 0,
    confirmedFields: [
      "setupPriceCents",
      "monthlyPriceCents",
      "monthlySoftwareCostCents",
      "setupHours",
    ],
  },
  {
    tier: "growth",
    name: "Growth",
    description: "Website, CRM and the core automations that remove admin work.",
    positioningNote:
      "From pricing. Scope varies with the client's systems, so the figure is a floor and must always be presented as one.",
    setupPriceCents: dollarsToCents(4_500),
    monthlyPriceCents: dollarsToCents(799),
    isFromPricing: true,
    monthlySoftwareCostCents: dollarsToCents(180),
    setupSoftwareCostCents: 0,
    setupHours: 35,
    // Assumed. More systems in play means more to monitor and adjust.
    monthlyHours: 3,
    labourRateCentsPerHour: ASSUMED_LABOUR_RATE_CENTS,
    usageBilling: "separate",
    estimatedMonthlyUsageCostCents: 0,
    usageAllowanceCents: 0,
    confirmedFields: [
      "setupPriceCents",
      "monthlyPriceCents",
      "monthlySoftwareCostCents",
      "setupHours",
    ],
  },
  {
    tier: "partner",
    name: "Partner",
    description:
      "Full stack, with ongoing optimisation, reporting and priority support.",
    positioningNote:
      "From pricing. The retainer buys availability and improvement, not a fixed list of deliverables.",
    setupPriceCents: dollarsToCents(8_000),
    monthlyPriceCents: dollarsToCents(1_500),
    isFromPricing: true,
    monthlySoftwareCostCents: dollarsToCents(350),
    setupSoftwareCostCents: 0,
    setupHours: 60,
    // Assumed. Includes reporting and proactive optimisation, not just upkeep.
    monthlyHours: 6,
    labourRateCentsPerHour: ASSUMED_LABOUR_RATE_CENTS,
    usageBilling: "separate",
    estimatedMonthlyUsageCostCents: 0,
    usageAllowanceCents: 0,
    confirmedFields: [
      "setupPriceCents",
      "monthlyPriceCents",
      "monthlySoftwareCostCents",
      "setupHours",
    ],
  },
];

/** Fields seeded from a default rather than supplied by the founder. */
export const ASSUMED_FIELDS: Array<keyof ServicePackage> = [
  "monthlyHours",
  "labourRateCentsPerHour",
  "setupSoftwareCostCents",
  "estimatedMonthlyUsageCostCents",
];

export function isConfirmedField(
  seed: PackageSeed,
  field: keyof ServicePackage,
): boolean {
  return seed.confirmedFields.includes(field);
}
