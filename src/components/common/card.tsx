import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Raised cards sit on `surface-2` — use sparingly, for the primary action. */
  elevated?: boolean;
}

export function Card({ children, className, elevated = false }: CardProps) {
  return (
    <div
      className={cn(
        // `min-w-0` so a card used as a grid or flex child can shrink below
        // its content's min-content width instead of forcing page overflow.
        "min-w-0 rounded-xl border border-border",
        elevated ? "bg-surface-2" : "bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
