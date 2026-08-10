"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  IDLE,
  updatePackage,
  updateProfile,
  updateTerm4Unlock,
  type ActionState,
} from "@/app/(app)/settings/actions";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/field";
import {
  centsToDollars,
  formatCurrency,
  formatPercent,
  monthlyMargin,
  setupMargin,
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

export function PackageForm({ pkg }: { pkg: PackageRow }) {
  const [state, action] = useActionState(updatePackage, IDLE);

  // Live margins from the saved figures, using the same engine the Business Lab
  // and the in-lesson exercises use.
  const setup = setupMargin(pkg);
  const monthly = monthlyMargin(pkg);

  return (
    <form action={action} className="space-y-4" noValidate>
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
        {pkg.isPlaceholder ? (
          <StatusPill tone="warning">Placeholder — not your numbers</StatusPill>
        ) : (
          <StatusPill tone="success">Live</StatusPill>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <MoneyField
          name="setupSoftwareCost"
          label="Setup software cost"
          value={pkg.setupSoftwareCostCents}
          error={state.fieldErrors?.setupSoftwareCost}
        />
        <MoneyField
          name="monthlySoftwareCost"
          label="Monthly software cost"
          value={pkg.monthlySoftwareCostCents}
          error={state.fieldErrors?.monthlySoftwareCost}
        />
        <Field label="Setup hours" error={state.fieldErrors?.setupHours}>
          {(props) => (
            <Input
              {...props}
              name="setupHours"
              type="number"
              step="0.5"
              min={0}
              defaultValue={pkg.setupHours}
            />
          )}
        </Field>
        <Field label="Monthly hours" error={state.fieldErrors?.monthlyHours}>
          {(props) => (
            <Input
              {...props}
              name="monthlyHours"
              type="number"
              step="0.5"
              min={0}
              defaultValue={pkg.monthlyHours}
            />
          )}
        </Field>
        <MoneyField
          name="labourRate"
          label="Labour cost per hour"
          value={pkg.labourRateCentsPerHour}
          error={state.fieldErrors?.labourRate}
        />
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3 sm:grid-cols-2">
        <MarginReadout
          label="Setup"
          profit={setup.grossProfitCents}
          margin={setup.grossMargin}
        />
        <MarginReadout
          label="Monthly"
          profit={monthly.grossProfitCents}
          margin={monthly.grossMargin}
        />
      </div>

      <div className="flex items-center gap-3">
        <SaveButton label={`Save ${pkg.name}`} />
        <Feedback state={state} />
      </div>
    </form>
  );
}

function MoneyField({
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
          step="1"
          min={0}
          defaultValue={centsToDollars(value)}
        />
      )}
    </Field>
  );
}

function MarginReadout({
  label,
  profit,
  margin,
}: {
  label: string;
  profit: number;
  margin: number | null;
}) {
  const healthy = margin !== null && margin >= 0.5;
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label} gross profit</div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-sm tabular-nums">
          {formatCurrency(profit)}
        </span>
        <span
          className={
            margin === null
              ? "text-xs text-subtle-foreground"
              : healthy
                ? "text-xs text-success"
                : "text-xs text-warning"
          }
        >
          {formatPercent(margin)}
          {margin !== null && !healthy ? " — thin for a services business" : ""}
        </span>
      </div>
    </div>
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
