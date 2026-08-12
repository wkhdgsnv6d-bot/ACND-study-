import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The client/server boundary.
 *
 * A `"use client"` module that imports a *value* from server-only code pulls
 * that code — and its `node:fs` / `next/headers` dependencies — into the
 * browser bundle, failing the production build with a stack trace that names
 * the wrong file. This has now happened three times: the lesson completion
 * helper, the pipeline stage constants, and the search index kind labels.
 *
 * The first two were direct imports. The third was not: the app shell imported
 * the command palette, which imported `KIND_LABELS` from the module that also
 * builds the index off disk. A one-level check saw nothing wrong. So this walks
 * the whole `@/` import graph from every client entry point.
 *
 * Type-only imports are erased at compile time and are not followed.
 *
 * The fix, every time, was the same and was the better design anyway: pure
 * constants and pure engines belong in `lib/domain` and `lib/engines`, apart
 * from the code that reads the database or the filesystem.
 */

const SRC = join(process.cwd(), "src");

/** Bare specifiers that must never reach the browser. */
const FORBIDDEN_BARE = [/^node:/, /^next\/headers$/, /^server-only$/];

/** Internal modules that reach the database, the request, or the disk. */
const FORBIDDEN_INTERNAL = [
  "@/lib/queries/",
  "@/lib/supabase/server",
  "@/lib/content/",
  "@/lib/db/",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return [".ts", ".tsx"].includes(extname(full)) ? [full] : [];
  });
}

function isTest(file: string): boolean {
  return /\.test\.tsx?$/.test(file);
}

function isClientModule(source: string): boolean {
  return /^\s*["']use client["']/m.test(source.slice(0, 200));
}

/**
 * A `"use server"` module is a real boundary, not a leak. Next replaces its
 * exports with RPC stubs in the browser bundle, so nothing it imports is
 * bundled for the client and the graph walk stops here.
 */
function isServerActionModule(source: string): boolean {
  return /^\s*["']use server["']/m.test(source.slice(0, 200));
}

/**
 * Import statements that bring in values. `import type { … }` and clauses whose
 * every specifier is `type`-prefixed are erased, so only the rest count.
 *
 * Dynamic `import("…")` counts too. Deferring a module to a lazy chunk does not
 * exempt it from being bundled for the browser — that is exactly how the search
 * index dragged `node:fs` in, past a guard that only read static imports.
 */
function valueImports(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /import\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;

  for (const match of source.matchAll(pattern)) {
    const [, typeKeyword, clause, specifier] = match;
    if (typeKeyword) continue;

    const named = clause?.trim().startsWith("{") && clause.trim().endsWith("}");
    if (named) {
      const inner = clause!.trim().slice(1, -1);
      const parts = inner.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0 && parts.every((p) => p.startsWith("type "))) continue;
    }

    specifiers.push(specifier!);
  }

  for (const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    specifiers.push(match[1]!);
  }

  return specifiers;
}

/** Resolve a `@/…` specifier the way the tsconfig path alias does. */
function resolveInternal(specifier: string): string | null {
  const base = join(SRC, specifier.slice("@/".length));
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Follow value imports from a client entry point until something forbidden
 * turns up, returning the chain that reaches it so the failure names the hop
 * that actually introduced the problem rather than only the endpoint.
 */
function findForbiddenPath(entry: string): string[] | null {
  const seen = new Set<string>();
  const queue: Array<{ file: string; chain: string[] }> = [
    { file: entry, chain: [relative(SRC, entry)] },
  ];

  while (queue.length > 0) {
    const { file, chain } = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, "utf8");
    if (file !== entry && isServerActionModule(source)) continue;

    for (const specifier of valueImports(source)) {
      if (FORBIDDEN_BARE.some((pattern) => pattern.test(specifier))) {
        return [...chain, specifier];
      }
      if (FORBIDDEN_INTERNAL.some((prefix) => specifier.startsWith(prefix))) {
        return [...chain, specifier];
      }
      if (!specifier.startsWith("@/")) continue;

      const resolved = resolveInternal(specifier);
      if (resolved && !seen.has(resolved)) {
        queue.push({ file: resolved, chain: [...chain, relative(SRC, resolved)] });
      }
    }
  }

  return null;
}

describe("client components", () => {
  const files = walk(SRC).filter((f) => !isTest(f));
  const clientFiles = files.filter((f) => isClientModule(readFileSync(f, "utf8")));

  it("exist — otherwise this guard is checking nothing", () => {
    expect(clientFiles.length).toBeGreaterThan(5);
  });

  it.each(clientFiles.map((f) => [relative(SRC, f), f] as const))(
    "%s reaches nothing server-only, at any depth",
    (name, file) => {
      const path = findForbiddenPath(file);

      expect(
        path,
        path
          ? `${name} reaches server-only code:\n  ${path.join("\n    → ")}\n` +
            "Move the shared value into lib/domain or lib/engines, or make it a type-only import."
          : "",
      ).toBeNull();
    },
  );
});
