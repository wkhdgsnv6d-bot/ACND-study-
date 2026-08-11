import { describe, expect, it } from "vitest";

import { PACKAGE_SEEDS } from "@/lib/domain/pricing";
import {
  absorbedUsageCostCents,
  arr,
  cac,
  capacity,
  dollarsToCents,
  estimateProject,
  expectedLifetimeMonths,
  formatPercent,
  hiringTrigger,
  lifetimeMargin,
  ltv,
  ltvToCacRatio,
  monthlyChurnRate,
  monthlyMargin,
  mrrMovement,
  packageEconomics,
  passThroughUsageCostCents,
  priceLabel,
  recurringClientCapacity,
  setupMargin,
  type ServicePackage,
} from "@/lib/engines/finance";

/** Ascend's real Growth package, as seeded into Settings. */
function growth(overrides: Partial<ServicePackage> = {}): ServicePackage {
  const seed = PACKAGE_SEEDS.find((p) => p.tier === "growth")!;
  return {
    tier: seed.tier,
    name: seed.name,
    setupPriceCents: seed.setupPriceCents,
    monthlyPriceCents: seed.monthlyPriceCents,
    isFromPricing: seed.isFromPricing,
    setupSoftwareCostCents: seed.setupSoftwareCostCents,
    monthlySoftwareCostCents: seed.monthlySoftwareCostCents,
    setupHours: seed.setupHours,
    monthlyHours: seed.monthlyHours,
    labourRateCentsPerHour: seed.labourRateCentsPerHour,
    usageBilling: seed.usageBilling,
    estimatedMonthlyUsageCostCents: seed.estimatedMonthlyUsageCostCents,
    usageAllowanceCents: seed.usageAllowanceCents,
    assumptionsReviewed: false,
    ...overrides,
  };
}

describe("seeded Ascend packages", () => {
  it("carries the founder's real prices", () => {
    const byTier = Object.fromEntries(PACKAGE_SEEDS.map((p) => [p.tier, p]));

    expect(byTier.essential!.setupPriceCents).toBe(dollarsToCents(1_500));
    expect(byTier.essential!.monthlyPriceCents).toBe(dollarsToCents(149));
    expect(byTier.essential!.monthlySoftwareCostCents).toBe(dollarsToCents(35));
    expect(byTier.essential!.setupHours).toBe(15);

    expect(byTier.growth!.setupPriceCents).toBe(dollarsToCents(4_500));
    expect(byTier.growth!.monthlyPriceCents).toBe(dollarsToCents(799));
    expect(byTier.growth!.monthlySoftwareCostCents).toBe(dollarsToCents(180));
    expect(byTier.growth!.setupHours).toBe(35);

    expect(byTier.partner!.setupPriceCents).toBe(dollarsToCents(8_000));
    expect(byTier.partner!.monthlyPriceCents).toBe(dollarsToCents(1_500));
    expect(byTier.partner!.monthlySoftwareCostCents).toBe(dollarsToCents(350));
    expect(byTier.partner!.setupHours).toBe(60);
  });

  it("keeps Growth and Partner as `from` pricing and Essential as fixed", () => {
    const byTier = Object.fromEntries(PACKAGE_SEEDS.map((p) => [p.tier, p]));

    expect(byTier.essential!.isFromPricing).toBe(false);
    expect(byTier.growth!.isFromPricing).toBe(true);
    expect(byTier.partner!.isFromPricing).toBe(true);
  });

  it("bills third-party and usage costs separately on every tier", () => {
    for (const seed of PACKAGE_SEEDS) {
      expect(seed.usageBilling).toBe("separate");
    }
  });
});

describe("priceLabel", () => {
  it("presents `from` pricing as a floor, never a flat rate", () => {
    expect(priceLabel({ isFromPricing: true }, dollarsToCents(4_500))).toBe(
      "From $4,500",
    );
    expect(priceLabel({ isFromPricing: false }, dollarsToCents(1_500))).toBe("$1,500");
  });
});

describe("usage cost treatment", () => {
  it("absorbs nothing when usage is billed separately", () => {
    const pkg = growth({
      usageBilling: "separate",
      estimatedMonthlyUsageCostCents: dollarsToCents(400),
    });

    expect(absorbedUsageCostCents(pkg)).toBe(0);
    expect(passThroughUsageCostCents(pkg)).toBe(dollarsToCents(400));
    expect(monthlyMargin(pkg).breakdown.usageCostCents).toBe(0);
  });

  it("absorbs up to the allowance and bills on the overage", () => {
    const pkg = growth({
      usageBilling: "allowance",
      estimatedMonthlyUsageCostCents: dollarsToCents(120),
      usageAllowanceCents: dollarsToCents(50),
    });

    expect(absorbedUsageCostCents(pkg)).toBe(dollarsToCents(50));
    expect(passThroughUsageCostCents(pkg)).toBe(dollarsToCents(70));
  });

  it("absorbs only the actual usage when it falls under the allowance", () => {
    const pkg = growth({
      usageBilling: "allowance",
      estimatedMonthlyUsageCostCents: dollarsToCents(30),
      usageAllowanceCents: dollarsToCents(50),
    });

    expect(absorbedUsageCostCents(pkg)).toBe(dollarsToCents(30));
    expect(passThroughUsageCostCents(pkg)).toBe(0);
  });

  it("absorbs the whole cost when it is included in the fee", () => {
    const pkg = growth({
      usageBilling: "included",
      estimatedMonthlyUsageCostCents: dollarsToCents(220),
    });

    expect(absorbedUsageCostCents(pkg)).toBe(dollarsToCents(220));
    expect(passThroughUsageCostCents(pkg)).toBe(0);
    expect(monthlyMargin(pkg).breakdown.usageCostCents).toBe(dollarsToCents(220));
  });
});

describe("package margins", () => {
  it("computes setup gross profit and margin from Ascend's Growth figures", () => {
    const result = setupMargin(growth());

    // 35h × $60 = $2,100 labour, no setup software cost, against $4,500.
    expect(result.costCents).toBe(dollarsToCents(2_100));
    expect(result.grossProfitCents).toBe(dollarsToCents(2_400));
    expect(result.grossMargin).toBeCloseTo(2400 / 4500);
  });

  it("computes recurring gross profit and margin", () => {
    const result = monthlyMargin(growth());

    // 3h × $60 = $180 labour + $180 software = $360 against $799.
    expect(result.costCents).toBe(dollarsToCents(360));
    expect(result.grossProfitCents).toBe(dollarsToCents(439));
    expect(result.grossMargin).toBeCloseTo(439 / 799);
  });

  it("combines setup and recurring over a client lifetime", () => {
    const result = lifetimeMargin(growth(), 12);

    expect(result.revenueCents).toBe(dollarsToCents(4_500 + 799 * 12));
    expect(result.costCents).toBe(dollarsToCents(2_100 + 360 * 12));
  });

  it("returns a null margin rather than dividing by zero", () => {
    expect(
      setupMargin(growth({ setupPriceCents: 0, setupHours: 0 })).grossMargin,
    ).toBeNull();
  });

  it("reports a negative gross profit rather than clamping it", () => {
    expect(
      setupMargin(growth({ setupPriceCents: dollarsToCents(500) })).grossProfitCents,
    ).toBeLessThan(0);
  });
});

describe("packageEconomics", () => {
  const economics = packageEconomics(growth());

  it("reports setup revenue, costs, hours and effective hourly rates", () => {
    expect(economics.setup.revenueCents).toBe(dollarsToCents(4_500));
    expect(economics.setup.labourCostCents).toBe(dollarsToCents(2_100));
    expect(economics.setup.hours).toBe(35);
    // $4,500 over 35 hours.
    expect(economics.setup.effectiveHourlyRevenueCents).toBeCloseTo(
      dollarsToCents(4_500) / 35,
    );
    expect(economics.setup.effectiveHourlyProfitCents).toBeCloseTo(
      dollarsToCents(2_400) / 35,
    );
  });

  it("reports monthly recurring revenue and gross profit", () => {
    expect(economics.monthly.revenueCents).toBe(dollarsToCents(799));
    expect(economics.monthly.softwareCostCents).toBe(dollarsToCents(180));
    expect(economics.monthly.grossProfitCents).toBe(dollarsToCents(439));
    expect(economics.monthly.grossMargin).toBeCloseTo(439 / 799);
  });

  it("reports annual recurring revenue and annual recurring gross profit", () => {
    expect(economics.annualRecurring.revenueCents).toBe(dollarsToCents(799 * 12));
    expect(economics.annualRecurring.grossProfitCents).toBe(dollarsToCents(439 * 12));
    expect(economics.annualRecurring.grossMargin).toBeCloseTo(439 / 799);
    expect(economics.annualRecurring.hours).toBe(36);
  });

  it("reports the first year as setup plus twelve recurring months", () => {
    expect(economics.firstYear.revenueCents).toBe(dollarsToCents(4_500 + 799 * 12));
    expect(economics.firstYear.grossProfitCents).toBe(
      dollarsToCents(2_400 + 439 * 12),
    );
    expect(economics.firstYear.hours).toBe(35 + 36);
  });

  it("carries the `from` pricing flag through, so it can never be shown as flat", () => {
    expect(economics.isFromPricing).toBe(true);
  });

  it("warns while the planning assumptions are unreviewed", () => {
    expect(economics.warnings.some((w) => w.includes("unreviewed estimates"))).toBe(
      true,
    );
    expect(
      packageEconomics(growth({ assumptionsReviewed: true })).warnings.some((w) =>
        w.includes("unreviewed estimates"),
      ),
    ).toBe(false);
  });

  it("warns when usage costs are absorbed rather than billed on", () => {
    const absorbed = packageEconomics(
      growth({
        usageBilling: "included",
        estimatedMonthlyUsageCostCents: dollarsToCents(200),
        assumptionsReviewed: true,
      }),
    );

    expect(absorbed.warnings.some((w) => w.includes("scale with the client"))).toBe(
      true,
    );
  });

  it("warns when expected usage already exceeds the allowance", () => {
    const overAllowance = packageEconomics(
      growth({
        usageBilling: "allowance",
        estimatedMonthlyUsageCostCents: dollarsToCents(200),
        usageAllowanceCents: dollarsToCents(50),
        assumptionsReviewed: true,
      }),
    );

    expect(
      overAllowance.warnings.some((w) => w.includes("exceeds the included allowance")),
    ).toBe(true);
  });

  it("warns on a loss-making monthly fee", () => {
    const losing = packageEconomics(
      growth({ monthlyPriceCents: dollarsToCents(100), assumptionsReviewed: true }),
    );

    expect(losing.monthly.grossProfitCents).toBeLessThan(0);
    expect(losing.warnings.some((w) => w.includes("loses money"))).toBe(true);
  });

  it("stays quiet when the economics are healthy and reviewed", () => {
    const healthy = packageEconomics(growth({ assumptionsReviewed: true }));
    expect(healthy.warnings).toEqual([]);
  });

  it("handles a zero-hour package without dividing by zero", () => {
    const noHours = packageEconomics(growth({ setupHours: 0, monthlyHours: 0 }));

    expect(noHours.setup.effectiveHourlyRevenueCents).toBeNull();
    expect(noHours.monthly.effectiveHourlyProfitCents).toBeNull();
  });
});

describe("every seeded package is economically viable at its assumptions", () => {
  it.each(PACKAGE_SEEDS.map((s) => [s.name, s] as const))(
    "%s clears a positive gross profit on setup and recurring",
    (_name, seed) => {
      const economics = packageEconomics({ ...seed, assumptionsReviewed: true });

      expect(economics.setup.grossProfitCents).toBeGreaterThan(0);
      expect(economics.monthly.grossProfitCents).toBeGreaterThan(0);
      expect(economics.annualRecurring.grossProfitCents).toBeGreaterThan(0);
    },
  );
});

describe("agency metrics", () => {
  it("computes CAC and guards against zero clients", () => {
    expect(cac({ salesAndMarketingSpendCents: 400_000, clientsAcquired: 4 })).toBe(
      100_000,
    );
    expect(cac({ salesAndMarketingSpendCents: 400_000, clientsAcquired: 0 })).toBeNull();
  });

  it("computes gross-profit LTV including setup profit", () => {
    const value = ltv({
      monthlyGrossProfitCents: dollarsToCents(439),
      monthlyChurnRate: 0.05,
      setupGrossProfitCents: dollarsToCents(2_400),
    });

    // $439 / 0.05 = $8,780 recurring, plus $2,400 setup.
    expect(value).toBe(dollarsToCents(11_180));
  });

  it("returns null LTV when churn is zero, because it is unbounded", () => {
    expect(ltv({ monthlyGrossProfitCents: 100, monthlyChurnRate: 0 })).toBeNull();
  });

  it("computes the LTV:CAC ratio only when both sides exist", () => {
    expect(ltvToCacRatio(300_000, 100_000)).toBe(3);
    expect(ltvToCacRatio(null, 100_000)).toBeNull();
    expect(ltvToCacRatio(300_000, 0)).toBeNull();
  });

  it("derives expected lifetime from churn", () => {
    expect(expectedLifetimeMonths(0.05)).toBe(20);
    expect(expectedLifetimeMonths(0)).toBeNull();
  });

  it("computes monthly churn and guards an empty base", () => {
    expect(monthlyChurnRate({ clientsLostInMonth: 1, clientsAtStartOfMonth: 20 })).toBe(
      0.05,
    );
    expect(
      monthlyChurnRate({ clientsLostInMonth: 0, clientsAtStartOfMonth: 0 }),
    ).toBeNull();
  });

  it("annualises MRR", () => {
    expect(arr(dollarsToCents(3000))).toBe(dollarsToCents(36_000));
  });
});

describe("mrrMovement", () => {
  it("computes closing MRR and net revenue retention", () => {
    const result = mrrMovement({
      openingCents: dollarsToCents(3000),
      newCents: dollarsToCents(1200),
      expansionCents: dollarsToCents(300),
      contractionCents: dollarsToCents(100),
      churnedCents: dollarsToCents(400),
    });

    expect(result.closingCents).toBe(dollarsToCents(4000));
    expect(result.netNewCents).toBe(dollarsToCents(1000));
    // NRR excludes new business: (3000 + 300 - 100 - 400) / 3000
    expect(result.netRevenueRetention).toBeCloseTo(2800 / 3000);
  });

  it("returns null retention from a zero base", () => {
    const result = mrrMovement({
      openingCents: 0,
      newCents: 100,
      expansionCents: 0,
      contractionCents: 0,
      churnedCents: 0,
    });

    expect(result.netRevenueRetention).toBeNull();
  });
});

describe("capacity", () => {
  it("classifies a comfortable week as healthy", () => {
    const result = capacity({
      deliverableHoursPerWeek: 30,
      committedRecurringHoursPerWeek: 8,
      committedProjectHoursPerWeek: 10,
    });

    expect(result.utilisation).toBeCloseTo(0.6);
    expect(result.status).toBe("healthy");
    expect(result.freeHours).toBe(12);
  });

  it("flags over-commitment rather than reporting 100%", () => {
    const result = capacity({
      deliverableHoursPerWeek: 30,
      committedRecurringHoursPerWeek: 20,
      committedProjectHoursPerWeek: 20,
    });

    expect(result.utilisation).toBeGreaterThan(1);
    expect(result.status).toBe("over-capacity");
    expect(result.freeHours).toBeLessThan(0);
  });

  it("tells an underutilised founder that sales is the constraint", () => {
    const result = capacity({
      deliverableHoursPerWeek: 30,
      committedRecurringHoursPerWeek: 2,
      committedProjectHoursPerWeek: 3,
    });

    expect(result.status).toBe("underutilised");
    expect(result.advice).toContain("sales");
  });
});

describe("recurringClientCapacity", () => {
  it("counts how many more clients the free hours can carry", () => {
    // 10 free hours a week ≈ 43.3 a month; Growth takes 3 a month.
    expect(
      recurringClientCapacity({ freeHoursPerWeek: 10, monthlyHoursPerClient: 3 }),
    ).toBe(14);
  });

  it("returns null when a client takes no maintenance hours at all", () => {
    expect(
      recurringClientCapacity({ freeHoursPerWeek: 10, monthlyHoursPerClient: 0 }),
    ).toBeNull();
  });
});

describe("hiringTrigger", () => {
  const base = {
    deliverableHoursPerWeek: 30,
    committedRecurringHoursPerWeek: 15,
    committedProjectHoursPerWeek: 12,
    sustainedUtilisation: 0.9,
    sustainedWeeks: 8,
    monthlyGrossProfitCents: dollarsToCents(12_000),
    proposedHireMonthlyCostCents: dollarsToCents(5_000),
    hasDocumentedSops: true,
  };

  it("approves a hire when all four conditions hold", () => {
    const result = hiringTrigger(base);

    expect(result.shouldHire).toBe(true);
    expect(result.conditions.every((c) => c.met)).toBe(true);
    expect(result.affordabilityMonths).toBeCloseTo(2.4);
  });

  it("blocks a hire when the work is undocumented", () => {
    const result = hiringTrigger({ ...base, hasDocumentedSops: false });

    expect(result.shouldHire).toBe(false);
    expect(result.recommendation).toContain("bottleneck");
  });

  it("blocks a hire on a two-week spike", () => {
    expect(hiringTrigger({ ...base, sustainedWeeks: 2 }).shouldHire).toBe(false);
  });

  it("blocks a hire that gross profit cannot carry", () => {
    const result = hiringTrigger({
      ...base,
      monthlyGrossProfitCents: dollarsToCents(6_000),
    });

    expect(result.shouldHire).toBe(false);
  });
});

describe("estimateProject", () => {
  it("adds a contingency buffer proportional to uncertainty", () => {
    const result = estimateProject({
      taskHours: [10, 8, 6, 4],
      uncertainty: 0.25,
      labourRateCentsPerHour: dollarsToCents(60),
      softwareCostCents: dollarsToCents(100),
      quotedPriceCents: dollarsToCents(6000),
    });

    expect(result.baseHours).toBe(28);
    expect(result.contingencyHours).toBe(7);
    expect(result.totalHours).toBe(35);
  });

  it("warns on a thin margin", () => {
    const result = estimateProject({
      taskHours: [20, 20, 20],
      uncertainty: 0.1,
      labourRateCentsPerHour: dollarsToCents(60),
      softwareCostCents: 0,
      quotedPriceCents: dollarsToCents(4500),
    });

    expect(result.warnings.some((w) => w.includes("below 50%"))).toBe(true);
  });

  it("warns loudly on a loss-making quote", () => {
    const result = estimateProject({
      taskHours: [40, 40, 40],
      uncertainty: 0.2,
      labourRateCentsPerHour: dollarsToCents(60),
      softwareCostCents: 0,
      quotedPriceCents: dollarsToCents(3000),
    });

    expect(result.margin.grossProfitCents).toBeLessThan(0);
    expect(result.warnings.some((w) => w.includes("loses money"))).toBe(true);
  });

  it("suggests paid discovery when uncertainty is high", () => {
    const result = estimateProject({
      taskHours: [10, 10, 10],
      uncertainty: 0.5,
      labourRateCentsPerHour: dollarsToCents(60),
      softwareCostCents: 0,
      quotedPriceCents: dollarsToCents(9000),
    });

    expect(result.warnings.some((w) => w.includes("paid discovery"))).toBe(true);
  });

  it("reports the effective hourly rate actually earned", () => {
    const result = estimateProject({
      taskHours: [10, 10],
      uncertainty: 0,
      labourRateCentsPerHour: dollarsToCents(60),
      softwareCostCents: 0,
      quotedPriceCents: dollarsToCents(4000),
    });

    expect(result.effectiveHourlyRateCents).toBe(dollarsToCents(200));
  });
});

describe("formatPercent", () => {
  it("renders an em dash for undefined ratios", () => {
    expect(formatPercent(null)).toBe("—");
  });

  it("renders whole percentages by default", () => {
    expect(formatPercent(0.567)).toBe("57%");
    expect(formatPercent(0.567, 1)).toBe("56.7%");
  });
});
