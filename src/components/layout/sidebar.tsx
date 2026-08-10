"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";

import {
  isActive,
  isAvailable,
  NAV_GROUPS,
  type NavItem,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group, index) => (
        <div key={group.label ?? `group-${index}`}>
          {group.label ? (
            <h2 className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wide text-subtle-foreground uppercase">
              {group.label}
            </h2>
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} pathname={pathname} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const available = isAvailable(item);
  const active = available && isActive(item.href, pathname);

  const shared =
    "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors";

  if (!available) {
    return (
      <span
        className={cn(shared, "cursor-not-allowed text-subtle-foreground")}
        title={`${item.note ? `${item.note}. ` : ""}Arrives in Phase ${item.phase}.`}
        aria-disabled="true"
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{item.label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[10px] text-subtle-foreground/70">
          <Lock className="size-3" aria-hidden />
          <span className="sr-only">Not yet built — </span>P{item.phase}
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        shared,
        active
          ? "bg-primary-muted font-medium text-primary"
          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}
