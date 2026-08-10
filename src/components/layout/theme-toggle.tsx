"use client";

import { Moon, Sun } from "lucide-react";

import { THEME_STORAGE_KEY } from "@/components/layout/theme-script";
import { Button } from "@/components/ui/button";

/**
 * Theme toggle with no React state at all.
 *
 * The current theme already lives in exactly one place — the `light` class on
 * `<html>`, applied before first paint by the inline script. Mirroring it into
 * component state would create a second source of truth, an effect that reads
 * the DOM on mount, and a hydration mismatch on the icon.
 *
 * Instead both icons render and CSS picks one via the `light:` variant, so the
 * correct icon is right on the very first paint, server and client agree, and
 * the click handler reads and writes the DOM directly.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const nextIsLight = !root.classList.contains("light");
    root.classList.toggle("light", nextIsLight);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextIsLight ? "light" : "dark");
    } catch {
      // Private browsing can reject writes. The theme still applies for this
      // session; it just will not be remembered.
    }
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      <Sun className="light:hidden" aria-hidden />
      <Moon className="hidden light:block" aria-hidden />
    </Button>
  );
}
