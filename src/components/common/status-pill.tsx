import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PillTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

const TONE_CLASSES: Record<PillTone, string> = {
  neutral: "bg-surface-3 text-muted-foreground border-border",
  primary: "bg-primary-muted text-primary border-primary/25",
  success: "bg-success-muted text-success border-success/25",
  warning: "bg-warning-muted text-warning border-warning/25",
  danger: "bg-destructive-muted text-destructive border-destructive/25",
  info: "bg-info-muted text-info border-info/25",
};

export function StatusPill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
