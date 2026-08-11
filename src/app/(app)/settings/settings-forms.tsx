"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  IDLE,
  updatePackage,
  updateProfile,
  updateTerm4Unlock,
  type ActionState,
} from "@/app/(app)/settings/actions";
import { PackageEconomicsPanel } from "@/components/business/package-economics";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/field";
import { USAGE_COST_POLICY } from "@/lib/domain/pricing";
import {
  centsToDollars,
  packageEconomics,
  priceLabel,
  type UsageBilling,
} from "@/lib/engines/finance";
import type { PackageRow, UserSettings } from "@/lib/queries/settings";

function SaveButton({ label = "Save" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      role="status"
      className={
        state.status === "success"
          ? "text-xs text-success"
          : "text-xs text-destructive"
      }
    >
      {state.message}
    </p>
  );
}

/* ------------------------------------------------------------------ */

export function ProfileForm({ settings }: { settings: UserSettings }) {
  const [state, action] = useActionState(updateProfile, IDLE);

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name" error={state.fieldErrors?.displayName}>
          {(props) => (
            <Input
              {...props}
              name="displayName"
              defaultValue={settings.displayName ?? ""}
              placeholder="Your name"
            />
          )}
        </Field>

        <Field
          label="Timezone"
          description="Streaks are counted in local calendar days, not UTC."
          error={state.fieldErrors?.timeZone}
          required
        >
          {(props) => (
            <Input {...props} name="timeZone" defaultValue={settings.timeZone} />
          )}
        </Field>

        <Field label="Currency" error={state.fieldErrors?.currency} required>
          {(props) => (
            <Input
              {...props}
              name="currency"
              defaultValue={settings.currency}
              maxLength={3}
              className="uppercase"
            />
          )}
        </Field>

        <Field
          label="Daily study target"
          description="Minutes. Drives the Today plan."
          error={state.fieldErrors?.dailyStudyTargetMinutes}
          required
        >
          {(props) => (
            <Input
              {...props}
              name="dailyStudyTargetMinutes"
              type="number"
              min={10}
              max={600}
              defaultValue={settings.dailyStudyTargetMinutes}
            />
          )}
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <SaveButton />
        <Feedback state={state} />
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

const USAGE_OPTIONS: Array<{ value: UsageBilling; label: string; detail: string }> = [
  {
    value: "separate",
    label: "Billed separately",
    detail:
      "The client pays the vendor directly, or is rebilled at cost. Ascend's margin is unaffected by how heavily they use it.",
  },
  {
    value: "allowance",
    label: "Included up to an allowance",
    detail:
      "A defined amount of usage is covered by the fee; anything beyond it is billed on. Ascend absorbs up to the allowance.",
  },
  {
    value: "included",
    label: "Absorbed into the monthly fee",
    detail:
      "Ascend carries the whole cost. Use sparingly — usage scales with the client's activity and you do not control it.",
  },
];

export function PackageForm({
  pkg,
  currency,
}: {
  pkg: PackageRow;
  currency: string;
}) {
  const [state, action] = useActionState(updatePackage, IDLE);
  const [usageBilling, setUsageBilling] = useState<UsageBilling>(pkg.usageBilling);

  // Live economics from the saved figures, computed by the same engine the
  // Business Lab and the in-lesson exercises use.
  const economics = packageEconomics(pkg);

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="id" value={pkg.id} />

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor={`name-${pkg.id}`} className="sr-only">
          Package name
        </Label>
        <Input
          id={`name-${pkg.id}`}
          name="name"
          defaultValue={pkg.name}
          className="h-8 w-40 font-medium"
        />
        <span className="font-mono text-sm text-muted-foreground tabular-nums">
          {priceLabel(pkg, pkg.setupPriceCents, { currency })} setup ·{" "}
          {priceLabel(pkg, pkg.monthlyPriceCents, { currency })}/mo
        </span>
        {pkg.isPlaceholder ? (
          <StatusPill tone="warning">No price entered</StatusPill>
        ) : null}
        {pkg.assumptionsReviewed ? (
          <StatusPill tone="success">Assumptions reviewed</StatusPill>
        ) : (
          <StatusPill tone="warning">Assumptions unreviewed</StatusPill>
        )}
      </div>

      {pkg.description ? (
        <p className="text-sm text-muted-foreground">{pkg.description}</p>
      ) : null}

      {/* -------------------------------------------------------------- */}
      <FieldGroup
        title="Customer-facing pricing"
        description="What the client is quoted. These are commitments."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyField
            name="setupPrice"
            label="Setup price"
            value={pkg.setupPriceCents}
            error={state.fieldErrors?.setupPrice}
          />
          <MoneyField
            name="monthlyPrice"
            label="Monthly price"
            value={pkg.monthlyPriceCents}
            error={state.fieldErrors?.monthlyPrice}
          />
        </div>
        <label className="mt-3 flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="isFromPricing"
            defaultChecked={pkg.isFromPricing}
            className="mt-0.5 size-4 rounded border-border accent-[var(--primary)]"
          />
          <span className="min-w-0 text-muted-foreground">
            <strong className="text-foreground">&ldquo;From&rdquo; pricing</strong> — the
            figure is a floor, not a fixed rate. Every surface that shows this package
            will present it as &ldquo;from&rdquo;, so it is never mistaken for a flat quote.
          </span>
        </label>
      </FieldGroup>

      {/* -------------------------------------------------------------- */}
      <FieldGroup
        title="Internal planning assumptions"
        description="Estimates for modelling, not customer-facing promises. Update them as real delivery data arrives."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField
            name="setupHours"
            label="Setup delivery hours"
            value={pkg.setupHours}
            error={state.fieldErrors?.setupHours}
          />
          <NumberField
            name="monthlyHours"
            label="Monthly hours"
            value={pkg.monthlyHours}
            error={state.fieldErrors?.monthlyHours}
          />
          <MoneyField
            name="labourRate"
            label="Labour cost per hour"
            value={pkg.labourRateCentsPerHour}
            error={state.fieldErrors?.labourRate}
          />
          <MoneyField
            name="monthlySoftwareCost"
            label="Monthly software cost"
            value={pkg.monthlySoftwareCostCents}
            error={state.fieldErrors?.monthlySoftwareCost}
          />
          <MoneyField
            name="setupSoftwareCost"
            label="Setup software cost"
            value={pkg.setupSoftwareCostCents}
            error={state.fieldErrors?.setupSoftwareCost}
          />
        </div>
        <label className="mt-3 flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="assumptionsReviewed"
            defaultChecked={pkg.assumptionsReviewed}
            className="mt-0.5 size-4 rounded border-border accent-[var(--primary)]"
          />
          <span className="min-w-0 text-muted-foreground">
            These have been checked against real delivery data. Until ticked, every
            figure derived from them carries a caveat.
          </span>
        </label>
      </FieldGroup>

      {/* -------------------------------------------------------------- */}
      <FieldGroup title="Third-party & usage costs" description={USAGE_COST_POLICY}>
        <fieldset className="space-y-2">
          <legend className="sr-only">Usage billing treatment</legend>
          {USAGE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-start gap-2.5 text-sm">
              <input
                type="radio"
                name="usageBilling"
                value={option.value}
                defaultChecked={pkg.usageBilling === option.value}
                onChange={() => setUsageBilling(option.value)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="min-w-0 text-muted-foreground">
                <strong className="text-foreground">{option.label}</strong> —{" "}
                {option.detail}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <MoneyField
            name="estimatedMonthlyUsageCost"
            label="Estimated monthly usage cost"
            value={pkg.estimatedMonthlyUsageCostCents}
            error={state.fieldErrors?.estimatedMonthlyUsageCost}
          />
          <MoneyField
            name="usageAllowance"
            label="Included monthly allowance"
            value={pkg.usageAllowanceCents}
            error={state.fieldErrors?.usageAllowance}
            disabled={usageBilling !== "allowance"}
          />
        </div>
      </FieldGroup>

      {/* -------------------------------------------------------------- */}
      <div>
        <h4 className="mb-3 text-sm font-medium">Economics</h4>
        <PackageEconomicsPanel economics={economics} currency={currency} />
      </div>

      <div className="flex items-center gap-3">
        <SaveButton label={`Save ${pkg.name}`} />
        <Feedback state={state} />
      </div>
    </form>
  );
}

function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface-2/40 px-4 py-3.5">
      <h4 className="text-sm font-medium">{title}</h4>
      {description ? (
        <p className="mt-1 mb-3 text-xs text-muted-foreground text-pretty">
          {description}
        </p>
      ) : null}
      {children}
    </section>
  );
}

function MoneyField({
  name,
  label,
  value,
  error,
  disabled = false,
}: {
  name: string;
  label: string;
  value: number;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label} error={error}>
      {(props) => (
        <Input
          {...props}
          name={name}
          type="number"
          step="1"
          min={0}
          disabled={disabled}
          defaultValue={centsToDollars(value)}
        />
      )}
    </Field>
  );
}

function NumberField({
  name,
  label,
  value,
  error,
}: {
  name: string;
  label: string;
  value: number;
  error?: string;
}) {
  return (
    <Field label={label} error={error}>
      {(props) => (
        <Input
          {...props}
          name={name}
          type="number"
          step="0.5"
          min={0}
          defaultValue={value}
        />
      )}
    </Field>
  );
}

/* ------------------------------------------------------------------ */

export function UnlockForm({ settings }: { settings: UserSettings }) {
  const [state, action] = useActionState(updateTerm4Unlock, IDLE);
  const config = settings.term4Unlock;

  return (
    <form action={action} className="space-y-4" noValidate>
      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={config.enabled}
          className="size-4 rounded border-border accent-[var(--primary)]"
        />
        Keep Term 4 locked until the business meets a threshold
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Unlock when</legend>
        {(["any", "all"] as const).map((mode) => (
          <label key={mode} className="flex items-start gap-2.5 text-sm">
            <input
              type="radio"
              name="mode"
              value={mode}
              defaultChecked={config.mode === mode}
              className="mt-0.5 size-4 accent-[var(--primary)]"
            />
            <span className="min-w-0 text-muted-foreground">
              {mode === "any" ? (
                <>
                  <strong className="text-foreground">Any one</strong> threshold is met —
                  different agencies reach CEO-level problems by different routes.
                </>
              ) : (
                <>
                  <strong className="text-foreground">Every</strong> threshold is met.
                </>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Monthly revenue" error={state.fieldErrors?.monthlyRevenue}>
          {(props) => (
            <Input
              {...props}
              name="monthlyRevenue"
              type="number"
              min={0}
              defaultValue={config.thresholds.monthlyRevenue ?? 0}
            />
          )}
        </Field>
        <Field label="MRR" error={state.fieldErrors?.mrr}>
          {(props) => (
            <Input
              {...props}
              name="mrr"
              type="number"
              min={0}
              defaultValue={config.thresholds.mrr ?? 0}
            />
          )}
        </Field>
        <Field label="Active clients" error={state.fieldErrors?.activeClients}>
          {(props) => (
            <Input
              {...props}
              name="activeClients"
              type="number"
              min={0}
              defaultValue={config.thresholds.activeClients ?? 0}
            />
          )}
        </Field>
        <Field label="Contractors" error={state.fieldErrors?.contractors}>
          {(props) => (
            <Input
              {...props}
              name="contractors"
              type="number"
              min={0}
              defaultValue={config.thresholds.contractors ?? 0}
            />
          )}
        </Field>
      </div>

      <Field
        label="Manual override"
        description="Leave blank to keep the gate. Filling this in unlocks Term 4 now and records why — so a future you knows whether it was a decision or an impulse."
        error={state.fieldErrors?.overrideReason}
      >
        {(props) => (
          <Input
            {...props}
            name="overrideReason"
            defaultValue={config.manualOverride?.reason ?? ""}
            placeholder="e.g. Taking on a business partner, need the finance material now"
          />
        )}
      </Field>

      <div className="flex items-center gap-3">
        <SaveButton />
        <Feedback state={state} />
      </div>
    </form>
  );
}
