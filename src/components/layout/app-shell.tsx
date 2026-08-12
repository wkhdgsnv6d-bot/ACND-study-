"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { SidebarNav } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { CommandPalette } from "@/components/search/command-palette";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Application shell: a fixed sidebar on desktop, a dismissible drawer on
 * mobile. Desktop-optimised as specified, but genuinely usable on a phone —
 * checking the pipeline between meetings is a real use case.
 */
export function AppShell({
  children,
  userEmail,
  displayName,
}: {
  children: ReactNode;
  userEmail: string | null;
  displayName: string | null;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  /**
   * Close the drawer on navigation by adjusting state during render rather than
   * in an effect. An effect would render the drawer over the new page for a
   * frame before closing it; this closes it in the same commit.
   */
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (pathname !== renderedPath) {
    setRenderedPath(pathname);
    if (drawerOpen) setDrawerOpen(false);
  }

  // Escape closes the drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface-1 lg:flex">
        <Brand />
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-border bg-surface-1">
            <Brand
              action={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close navigation"
                  onClick={() => setDrawerOpen(false)}
                >
                  <X />
                </Button>
              }
            />
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu />
          </Button>

          <span className="text-sm font-medium lg:hidden">Ascend</span>

          <div className="ml-auto flex items-center gap-1.5">
            <CommandPalette />
            <ThemeToggle />
            <UserMenu email={userEmail} displayName={displayName} />
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

function Brand({ action }: { action?: ReactNode }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <Link
        href="/dashboard"
        className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AscendMark className="size-6 shrink-0" />
        <span className="min-w-0 truncate text-sm font-semibold tracking-tight">
          Ascend
        </span>
      </Link>
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}

/** A rising step motif — three ascending bars. Drawn, not imported. */
function AscendMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("text-primary", className)}
    >
      <rect x="3" y="14" width="4.5" height="7" rx="1.25" fill="currentColor" opacity="0.45" />
      <rect x="9.75" y="9" width="4.5" height="12" rx="1.25" fill="currentColor" opacity="0.72" />
      <rect x="16.5" y="3" width="4.5" height="18" rx="1.25" fill="currentColor" />
    </svg>
  );
}
