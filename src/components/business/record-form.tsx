"use client";

import { Plus } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

import { Card, CardBody, CardHeader } from "@/components/common/card";
import { Button } from "@/components/ui/button";
import type { RecordResult } from "@/app/(app)/business-actions";

/**
 * A collapsible form for adding a business record.
 *
 * One component rather than three near-identical ones, because a prospect, a
 * validation interview and a revenue entry differ only in their fields. The
 * fields are passed as children; everything about submission, pending state,
 * errors and collapsing is shared.
 */
export function RecordForm({
  title,
  addLabel,
  action,
  children,
  errors,
  open: controlledOpen,
  alwaysOpen = false,
  onSaved,
}: {
  title: string;
  addLabel: string;
  action: (formData: FormData) => Promise<RecordResult>;
  children: ReactNode;
  errors?: Record<string, string>;
  open?: boolean;
  alwaysOpen?: boolean;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(controlledOpen ?? alwaysOpen);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {addLabel}
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title={title}
        action={
          alwaysOpen ? null : (
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          )
        }
      />
      <CardBody>
        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await action(formData);
              setFailed(!result.ok);
              setMessage(
                result.message ??
                  (result.fieldErrors
                    ? Object.values(result.fieldErrors)[0] ?? "Check the fields above."
                    : null),
              );
              if (result.ok) {
                onSaved?.();
                if (!alwaysOpen) setOpen(false);
              }
            })
          }
          className="space-y-4"
          noValidate
        >
          {children}

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            {message ? (
              <span
                role="status"
                className={failed ? "text-xs text-destructive" : "text-xs text-success"}
              >
                {message}
              </span>
            ) : null}
            {errors && Object.keys(errors).length > 0 ? (
              <span className="text-xs text-destructive">
                {Object.values(errors)[0]}
              </span>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function Select({
  name,
  label,
  options,
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
        {required ? (
          <span className="ml-1 text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
