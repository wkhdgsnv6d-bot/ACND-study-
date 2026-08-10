import { cn } from "@/lib/utils";

interface ProgressBarProps {
  /** 0–1. Values outside the range are clamped. */
  value: number;
  className?: string;
  tone?: "primary" | "success" | "warning" | "muted";
  size?: "sm" | "md";
  /** Accessible description. Required — a bare bar tells a screen reader nothing. */
  label: string;
  /** Renders the percentage beside the bar. */
  showValue?: boolean;
}

const TONE_CLASSES: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  muted: "bg-muted-foreground",
};

export function ProgressBar({
  value,
  className,
  tone = "primary",
  size = "md",
  label,
  showValue = false,
}: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const percent = Math.round(clamped * 100);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-surface-3",
          size === "sm" ? "h-1.5" : "h-2",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            TONE_CLASSES[tone],
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showValue ? (
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {percent}%
        </span>
      ) : null}
    </div>
  );
}
