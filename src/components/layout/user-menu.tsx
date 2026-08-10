"use client";

import Link from "next/link";
import { LogOut, Settings as SettingsIcon, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function UserMenu({
  email,
  displayName,
}: {
  email: string | null;
  displayName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = displayName || email || "Account";
  const initial = (displayName || email || "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-primary-muted text-xs font-medium text-primary">
          {initial}
        </span>
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1.5 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
        >
          <div className="border-b border-border px-3 py-2.5">
            {displayName ? (
              <p className="truncate text-sm font-medium">{displayName}</p>
            ) : null}
            {email ? (
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            ) : null}
          </div>

          <div className="p-1">
            <MenuLink href="/settings" icon={User} onSelect={() => setOpen(false)}>
              Profile
            </MenuLink>
            <MenuLink
              href="/settings#pricing"
              icon={SettingsIcon}
              onSelect={() => setOpen(false)}
            >
              Ascend pricing
            </MenuLink>
          </div>

          <div className="border-t border-border p-1">
            {/* A real form POST, not a link: signing out is a state change and
                must not be triggerable by a prefetch or a crawler. */}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <LogOut className="size-4 shrink-0" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
  onSelect,
}: {
  href: string;
  icon: typeof User;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
    </Link>
  );
}
