import { describe, expect, it } from "vitest";

import {
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
  setupMargin,
  type ServicePackage,
} from "@/lib/engines/finance";

/**
 * Placeholder economics until the real Ascend package numbers are entered in
 * Settings. Tests assert the *arithmetic*, so they stay valid whatever the
 * prices become.
 */
const growth: ServicePackage = {
  tier: "growth",
  name: "Growth",
  setupPriceCents: dollarsToCents(6000),
  monthlyPriceCents: dollarsToCents(1200),
  monthlySoftwareCostCents: dollarsToCents(180),
  setupSoftwareCostCents: dollarsToCents(200),
  setupHours: 40,
  monthlyHours: 6,
  labourRateCentsPerHour: dollarsToCents(60),
};

describe("package margins", () => {
  it("computes setup gross profit and margin", () => {
    const result = setupMargin(growth);

    // 40h × $60 = $2,400 labour + $200 software = $2,600 cost against $6,000.
    expect(result.costCents).toBe(dollarsToCents(2600));
    expect(result.grossProfitCents).toBe(dollarsToCents(3400));
    expect(result.grossMargin).toBeCloseTo(3400 / 6000);
  });

  it("computes recurring gross profit and margin", () => {
    const result = monthlyMargin(growth);

    // 6h × $60 = $360 labour + $180 software = $540 against $1,200.
    expect(result.costCents).toBe(dollarsToCents(540));
    expect(result.grossMargin).toBeCloseTo(660 / 1200);
  });

  it("combines setup and recurring over a client lifetime", () => {
    const result = lifetimeMargin(growth, 12);

    expect(result.revenueCents).toBe(dollarsToCents(6000 + 1200 * 12));
    expect(result.costCents).toBe(dollarsToCents(2600 + 540 * 12));
  });

  it("returns a null margin rather than dividing by zero", () => {
    const free: ServicePackage = { ...growth, setupPriceCents: 0, setupHours: 0, setupSoftwareCostCents: 0 };
    expect(setupMargin(free).grossMargin).toBeNull();
  });

  it("reports a negative gross profit rather than clamping it", () => {
    const underpriced: ServicePackage = { ...growth, setupPriceCents: dollarsToCents(1000) };
    expect(setupMargin(underpriced).grossProfitCents).toBeLessThan(0);
  });
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
      monthlyGrossProfitCents: dollarsToCents(660),
      monthlyChurnRate: 0.05,
      setupGrossProfitCents: dollarsToCents(3400),
    });

    // $660 / 0.05 = $13,200 recurring, plus $3,400 setup.
    expect(value).toBe(dollarsToCents(16_600));
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
