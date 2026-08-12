import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Server action authorisation.
 *
 * Every exported function in a `"use server"` module is a public HTTP endpoint.
 * Next generates an id for it and the browser can invoke it directly — being
 * unreachable from the UI proves nothing, and neither does the proxy, which
 * guards page navigations rather than action invocations.
 *
 * Row-level security is the real backstop: an action that forgets to
 * authenticate still cannot read another account's rows. But it would run
 * against whatever session the request carries, and an unauthenticated caller
 * would get a confusing failure deep in the query layer rather than a clean
 * refusal. So every action authenticates first, and this asserts it rather than
 * relying on the next person to remember.
 *
 * The sign-in and sign-up actions are the deliberate exception: authenticating
 * is what they are for.
 */

const SRC = join(process.cwd(), "src");

/** Actions that must be callable without a session, and why. */
const PUBLIC_ACTIONS = new Set(["signIn", "signUp"]);

const AUTH_GUARDS = ["requireUser", "getCurrentUser"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return [".ts", ".tsx"].includes(extname(full)) ? [full] : [];
  });
}

function isServerActionModule(source: string): boolean {
  return /^\s*["']use server["']/m.test(source.slice(0, 200));
}

/**
 * Exported async functions and their bodies, sliced from one `export async
 * function` to the next. Crude, but it does not need to be a parser: it only
 * has to attribute a guard call to the right function, and actions are
 * top-level declarations by necessity.
 */
function exportedActions(source: string): Array<{ name: string; body: string }> {
  const pattern = /^export\s+async\s+function\s+(\w+)/gm;
  const starts: Array<{ name: string; index: number }> = [];

  for (const match of source.matchAll(pattern)) {
    starts.push({ name: match[1]!, index: match.index! });
  }

  return starts.map((start, i) => ({
    name: start.name,
    body: source.slice(start.index, starts[i + 1]?.index ?? source.length),
  }));
}

const actionModules = walk(SRC)
  .filter((f) => !/\.test\.tsx?$/.test(f))
  .filter((f) => isServerActionModule(readFileSync(f, "utf8")));

describe("server actions", () => {
  it("exist — otherwise this guard is checking nothing", () => {
    expect(actionModules.length).toBeGreaterThan(3);
  });

  const actions = actionModules.flatMap((file) =>
    exportedActions(readFileSync(file, "utf8")).map(
      (action) => [relative(SRC, file), action.name, action.body] as const,
    ),
  );

  it("are all discovered", () => {
    expect(actions.length).toBeGreaterThan(15);
  });

  it.each(actions)("%s › %s authenticates before doing anything", (_file, name, body) => {
    if (PUBLIC_ACTIONS.has(name)) return;

    const guarded = AUTH_GUARDS.some((guard) => body.includes(`${guard}(`));

    expect(
      guarded,
      `${name} never calls ${AUTH_GUARDS.join(" or ")}. Every exported function in a ` +
        `"use server" module is a public endpoint; add the guard, or add it to ` +
        `PUBLIC_ACTIONS with a reason if it genuinely must be reachable without a session.`,
    ).toBe(true);
  });
});
