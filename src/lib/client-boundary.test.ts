import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The client/server boundary.
 *
 * A `"use client"` file that imports a *value* from the query layer pulls the
 * Supabase server client — and `next/headers` with it — into the browser
 * bundle, which fails the production build with a stack trace that names the
 * wrong file. This has happened twice: once with the lesson completion helper
 * and once with the pipeline stage constants.
 *
 * Type-only imports are erased at compile time and are fine. Value imports are
 * not. Rather than remember, this asserts it.
 *
 * The fix, both times, was the same and was the better design anyway: pure
 * domain constants and pure engines belong in `lib/domain` and `lib/engines`,
 * not next to the code that reads the database.
 */

const SRC = join(process.cwd(), "src");

/** Modules that reach the database or request context, directly or otherwise. */
const SERVER_ONLY = ["@/lib/queries/", "@/lib/supabase/server"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return [".ts", ".tsx"].includes(extname(full)) ? [full] : [];
  });
}

function isClientModule(source: string): boolean {
  return /^\s*["']use client["']/m.test(source.slice(0, 200));
}

/**
 * Import statements that bring in values. `import type { … }` and inline
 * `type` specifiers are erased, so only a bare import counts.
 */
function valueImports(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /import\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;

  for (const match of source.matchAll(pattern)) {
    const [, typeKeyword, clause, specifier] = match;
    if (typeKeyword) continue;

    // `import { type A, type B } from "…"` is also fully erased.
    const named = clause?.trim().startsWith("{") && clause.trim().endsWith("}");
    if (named) {
      const inner = clause!.trim().slice(1, -1);
      const parts = inner.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0 && parts.every((p) => p.startsWith("type "))) continue;
    }

    specifiers.push(specifier!);
  }

  return specifiers;
}

describe("client components", () => {
  const files = walk(SRC).filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));
  const clientFiles = files.filter((f) => isClientModule(readFileSync(f, "utf8")));

  it("exist — otherwise this guard is checking nothing", () => {
    expect(clientFiles.length).toBeGreaterThan(5);
  });

  it.each(clientFiles.map((f) => [relative(SRC, f), f] as const))(
    "%s does not pull server-only modules into the browser bundle",
    (name, file) => {
      const offending = valueImports(readFileSync(file, "utf8")).filter((specifier) =>
        SERVER_ONLY.some((prefix) => specifier.startsWith(prefix)),
      );

      expect(
        offending,
        `${name} imports values from ${offending.join(", ")}. Move the shared value into lib/domain or lib/engines, or make it a type-only import.`,
      ).toEqual([]);
    },
  );
});
