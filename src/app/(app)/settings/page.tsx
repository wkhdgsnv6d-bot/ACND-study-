import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  PackageForm,
  ProfileForm,
  UnlockForm,
} from "@/app/(app)/settings/settings-forms";
import { Card, CardBody, CardHeader } from "@/components/common/card";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { getSettings } from "@/lib/queries/settings";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const settings = await getSettings(user);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Settings"
        description="Your profile, Ascend's real pricing, and the rules that govern Term 4."
      />

      {settings.error ? (
        <ErrorState
          className="mt-6"
          title="Could not load settings"
          description={
            <>
              {settings.error} If this is a fresh Supabase project, run{" "}
              <code className="font-mono text-xs">npm run db:migrate</code> first.
            </>
          }
        />
      ) : null}

      <div className="mt-8 space-y-6">
        <Card id="profile">
          <CardHeader
            title="Profile"
            description="Timezone matters more than it looks — every streak is counted against your local calendar day."
          />
          <CardBody>
            <ProfileForm settings={settings} />
          </CardBody>
        </Card>

        <Card id="pricing">
          <CardHeader
            title="Ascend pricing"
            description="These rows drive every margin exercise, calculator and financial simulation in the platform — nothing hard-codes a price. Prices are yours; the delivery hours and cost figures alongside them are editable planning assumptions, not customer-facing promises."
          />
          <CardBody className="space-y-8">
            {settings.packages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No packages yet. They are created automatically once the database is
                connected.
              </p>
            ) : (
              settings.packages.map((pkg) => (
                <PackageForm key={pkg.id} pkg={pkg} currency={settings.currency} />
              ))
            )}
          </CardBody>
        </Card>

        <Card id="unlocks">
          <CardHeader
            title="Term 4 unlock"
            description="CEO material is not harder — it is premature. Term 4 opens when Ascend produces evidence that it now applies."
          />
          <CardBody>
            <UnlockForm settings={settings} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
