import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Row-level security is the only thing standing between a bug and a client's
 * data. It is far too easy to add a table and forget the policy, so this reads
 * the generated SQL and asserts the invariant directly rather than trusting
 * that the schema helper was used.
 */

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

function migrationSql(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8")).join("\n");
}

function createdTables(sql: string): string[] {
  return [...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"([a-z_]+)"/g)].map(
    (m) => m[1]!,
  );
}

function droppedTables(sql: string): string[] {
  return [...sql.matchAll(/DROP TABLE (?:IF EXISTS )?"([a-z_]+)"/g)].map((m) => m[1]!);
}

describe("row-level security", () => {
  const sql = migrationSql();
  const tables = createdTables(sql).filter((t) => !droppedTables(sql).includes(t));

  it("creates the expected tables", () => {
    expect(tables.length).toBeGreaterThanOrEqual(26);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it.each(
    createdTables(migrationSql()).filter(
      (t) => !droppedTables(migrationSql()).includes(t),
    ),
  )("enables RLS on %s", (table) => {
    expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });

  it.each(
    createdTables(migrationSql()).filter(
      (t) => !droppedTables(migrationSql()).includes(t),
    ),
  )("gives %s an owner policy scoped to auth.uid()", (table) => {
    const policy = new RegExp(
      `CREATE POLICY "${table}_owner" ON "${table}"[^;]*`,
      "g",
    ).exec(sql);

    expect(policy, `no owner policy found for ${table}`).not.toBeNull();

    const statement = policy![0];
    expect(statement, `${table} policy is not scoped to the authenticated role`).toContain(
      'TO "authenticated"',
    );
    expect(statement, `${table} policy has no USING clause`).toContain("auth.uid()");
    // Without WITH CHECK, a user could insert or update rows owned by someone
    // else even though they could not read them back.
    expect(statement, `${table} policy has no WITH CHECK clause`).toContain(
      "WITH CHECK",
    );
  });

  it("never grants access to the anon role", () => {
    expect(sql).not.toContain('TO "anon"');
  });

  it("scopes every table to a user, directly or by primary key", () => {
    // `profiles` is keyed by the auth user id itself; everything else carries
    // an explicit `user_id` column.
    for (const table of tables) {
      if (table === "profiles") continue;
      const create = new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?"${table}" \\(([^;]*)\\)`, "s").exec(
        sql,
      );
      expect(create, `could not parse CREATE TABLE for ${table}`).not.toBeNull();
      expect(create![1], `${table} has no user_id column`).toContain('"user_id" uuid');
    }
  });
});
