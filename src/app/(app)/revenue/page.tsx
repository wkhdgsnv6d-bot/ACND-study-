import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RevenueTracker } from "@/app/(app)/revenue/revenue-tracker";
import { PageHeader, StatCard } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { arr, formatCurrency } from "@/lib/engines/finance";
import { getRevenue } from "@/lib/queries/business";
import { getSettings } from "@/lib/queries/settings";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Revenue" };

export default async function RevenuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [{ entries, clients, error }, settings] = await Promise.all([
    getRevenue(user),
    getSettings(user),
  ]);

  const currency = settings.currency;
  const total = entries.reduce((sum, e) => sum + e.amountCents, 0);
  const collected = entries
    .filter((e) => e.paidOn)
    .reduce((sum, e) => sum + e.amountCents, 0);
  const outstanding = total - collected;
  const mrr = clients
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + c.mrrCents, 0);

  const monthStart = `${new Date().toISOString().slice(0, 8)}01`;
  const thisMonth = entries
    .filter((e) => e.incurredOn >= monthStart)
    .reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Revenue"
        description="What Ascend has actually earned and collected. These figures drive the Term 4 unlock, so they are worth keeping honest."
      />

      {error ? <ErrorState className="mt-6" description={error} /> : null}

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="MRR"
          value={formatCurrency(mrr, { currency })}
          hint={`${clients.filter((c) => c.status === "active").length} active`}
          tone={mrr > 0 ? "success" : "muted"}
        />
        <StatCard
          label="ARR"
          value={formatCurrency(arr(mrr), { currency })}
          hint="MRR × 12"
        />
        <StatCard
          label="This month"
          value={formatCurrency(thisMonth, { currency })}
        />
        <StatCard
          label="Collected"
          value={formatCurrency(collected, { currency })}
          tone={collected > 0 ? "success" : "muted"}
          hint="All time"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(outstanding, { currency })}
          tone={outstanding > 0 ? "muted" : undefined}
          hint="Earned, not yet paid"
        />
      </section>

      <div className="mt-8">
        <RevenueTracker entries={entries} clients={clients} currency={currency} />
      </div>
    </div>
  );
}
