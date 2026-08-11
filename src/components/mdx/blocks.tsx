import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Info,
  Lightbulb,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Lesson content blocks.
 *
 * These exist so 250 lessons share one visual language and a design change is
 * one edit rather than 250. They also encode two rules from the specification
 * structurally rather than by convention:
 *
 * - `SecurityWarning` gives credential and privacy risks a distinct, alarming
 *   treatment that ordinary prose cannot accidentally imitate.
 * - `VendorNote` fences off vendor-specific instructions from the concept being
 *   taught, so when a tool redesigns its interface the surrounding lesson is
 *   still correct.
 */

type CalloutTone = "note" | "tip" | "warning" | "danger" | "success";

const CALLOUT_STYLES: Record<
  CalloutTone,
  { icon: typeof Info; wrapper: string; icon_: string; label: string }
> = {
  note: {
    icon: Info,
    wrapper: "border-info/25 bg-info-muted",
    icon_: "text-info",
    label: "Note",
  },
  tip: {
    icon: Lightbulb,
    wrapper: "border-primary/25 bg-primary-muted",
    icon_: "text-primary",
    label: "Tip",
  },
  warning: {
    icon: AlertTriangle,
    wrapper: "border-warning/25 bg-warning-muted",
    icon_: "text-warning",
    label: "Warning",
  },
  danger: {
    icon: AlertTriangle,
    wrapper: "border-destructive/25 bg-destructive-muted",
    icon_: "text-destructive",
    label: "Careful",
  },
  success: {
    icon: CheckCircle2,
    wrapper: "border-success/25 bg-success-muted",
    icon_: "text-success",
    label: "Good practice",
  },
};

export function Callout({
  type = "note",
  title,
  children,
}: {
  type?: CalloutTone;
  title?: string;
  children: ReactNode;
}) {
  const style = CALLOUT_STYLES[type];
  const Icon = style.icon;

  return (
    <aside
      className={cn(
        "my-6 flex gap-3 rounded-xl border px-4 py-3.5 text-sm",
        style.wrapper,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", style.icon_)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", style.icon_)}>{title ?? style.label}</p>
        <div className="mt-1 space-y-2 text-muted-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {children}
        </div>
      </div>
    </aside>
  );
}

/**
 * Anything that can leak a credential, expose client data, or breach privacy.
 * Deliberately louder than a warning callout — these are the mistakes that cost
 * someone else's data rather than your afternoon.
 */
export function SecurityWarning({
  title = "Security",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className="my-6 overflow-hidden rounded-xl border border-destructive/35">
      <div className="flex items-center gap-2 border-b border-destructive/25 bg-destructive-muted px-4 py-2">
        <ShieldAlert className="size-4 shrink-0 text-destructive" aria-hidden />
        <p className="text-sm font-semibold text-destructive">{title}</p>
      </div>
      <div className="space-y-2 bg-destructive-muted/40 px-4 py-3.5 text-sm text-muted-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </aside>
  );
}

/**
 * Vendor-specific instructions, fenced off from the concept.
 *
 * The concept is taught in the lesson body and survives interface redesigns.
 * Anything that describes where a button lives goes in here, so when it moves,
 * one block changes and the lesson does not.
 */
export function VendorNote({
  tool,
  children,
}: {
  tool: string;
  children: ReactNode;
}) {
  return (
    <aside className="my-6 overflow-hidden rounded-xl border border-border bg-surface-2">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Wrench className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-xs font-medium">
          In {tool}
          <span className="ml-2 font-normal text-subtle-foreground">
            interface-specific — the concept above is what lasts
          </span>
        </p>
      </div>
      <div className="space-y-2 px-4 py-3.5 text-sm text-muted-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </aside>
  );
}

/**
 * A worked example from Ascend itself rather than a generic company. The
 * specification is explicit that exercises should reference the real business,
 * and this block is where that happens in prose.
 */
export function AscendExample({
  title = "For Ascend",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className="my-6 overflow-hidden rounded-xl border border-primary/25">
      <div className="flex items-center gap-2 border-b border-primary/20 bg-primary-muted px-4 py-2">
        <Building2 className="size-3.5 shrink-0 text-primary" aria-hidden />
        <p className="text-xs font-semibold text-primary">{title}</p>
      </div>
      <div className="space-y-2 px-4 py-3.5 text-sm text-muted-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </aside>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="my-6 space-y-4 [counter-reset:step] list-none pl-0">{children}</ol>
  );
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="relative pl-9 [counter-increment:step]">
      <span
        aria-hidden
        className="absolute left-0 top-0 flex size-6 items-center justify-center rounded-full bg-surface-3 font-mono text-xs before:content-[counter(step)]"
      />
      <p className="font-medium">{title}</p>
      <div className="mt-1 space-y-2 text-muted-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </li>
  );
}

/** Side-by-side comparison, for "when to use X vs Y" decisions. */
export function Comparison({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("my-6 grid gap-4 sm:grid-cols-2", className)}>{children}</div>
  );
}

export function Option({
  title,
  verdict,
  children,
}: {
  title: string;
  verdict?: "good" | "bad" | "neutral";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3.5",
        verdict === "good" && "border-success/25 bg-success-muted",
        verdict === "bad" && "border-destructive/25 bg-destructive-muted",
        (verdict === "neutral" || !verdict) && "border-border bg-surface-2",
      )}
    >
      <p
        className={cn(
          "text-sm font-medium",
          verdict === "good" && "text-success",
          verdict === "bad" && "text-destructive",
        )}
      >
        {title}
      </p>
      <div className="mt-1.5 space-y-2 text-sm text-muted-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}

export function Figure({
  caption,
  children,
}: {
  caption?: string;
  children: ReactNode;
}) {
  return (
    <figure className="my-6">
      <div className="overflow-x-auto rounded-xl border border-border bg-surface-2 p-4">
        {children}
      </div>
      {caption ? (
        <figcaption className="mt-2 text-center text-xs text-subtle-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
