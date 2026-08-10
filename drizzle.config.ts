import { defineConfig } from "drizzle-kit";

/**
 * Drizzle owns the schema: `src/lib/db/schema.ts` is the source of truth and
 * SQL migrations are generated from it, so the schema lives in version control
 * rather than in a dashboard.
 *
 * `DATABASE_URL` is only needed for `db:push` and `db:migrate`. Generating a
 * migration (`npm run db:generate`) works offline, which is what lets the
 * schema be developed and reviewed before any Supabase project exists.
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Supabase manages `auth`, `storage` and the rest; Drizzle must not try to
  // diff or drop anything outside `public`.
  schemaFilter: ["public"],
  entities: {
    roles: {
      provider: "supabase",
    },
  },
  verbose: true,
  strict: true,
});
