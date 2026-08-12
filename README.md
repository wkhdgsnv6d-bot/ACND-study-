# Ascend Business Mastery

A private operating school for building **Ascend** — an AI automation and web
development agency.

Not a course website. A platform that takes one person from beginner, to
technically client-ready, to agency operator, to a founder who can run the
company rather than only do the work — and that gradually becomes the
lightweight operating system for the agency itself.

The governing principle:

> **Learn → Build → Test → Apply → Prove → Certify**

Reading a lesson does not equal competence, and the platform enforces that
structurally rather than merely suggesting it. Skill levels are the minimum of
what you have *studied* and what you have *proven*; no certification in the
system can be earned by lesson completion alone.

---

## Status

**Phases 1–7 complete** — the platform itself is built. Design system, content
pipeline and scoring engines; database with row-level security; authentication,
application shell, dashboard and settings; the lesson experience (MDX rendering,
reading progress, server-graded knowledge checks, spaced repetition seeded from
wrong answers, notes, evidence-bearing practical submissions); the skill tree,
certifications and interactive labs; the Business Lab, Client Pipeline, Market
Validation and Revenue surfaces; the Software Library, Template Vault, Projects
and Resources; and search with a ⌘K palette, the Today plan, Review sessions,
Weekly Review, progress analytics and full data export.

**Phase 8 — the curriculum itself — is in progress.** Only lessons marked
`status: complete` count toward anything; `npm run content:check` prints exactly
how much of each term is written. Module exams are deferred, and the AI Study
Assistant (Phase 10) is not built. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full plan and the
reasoning behind each decision.

The sidebar marks every surface that is not built yet with the phase that
builds it, so the app always tells the truth about what exists.

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Styling | Tailwind CSS v4, dark-first design tokens |
| Content | MDX with Zod-validated frontmatter |
| Data | Supabase Postgres, RLS on all 27 tables |
| Pricing | Ascend's real Essential / Growth / Partner figures, editable in Settings |
| Auth | Supabase Auth, guarded in `src/proxy.ts` and re-checked server-side |
| Tests | 223 passing across 10 suites |

---

## Getting started

```bash
npm install
npm run dev
```

The app boots without credentials — `dev`, `build` and `test` all work with no
`.env.local`, and every route shows an explanatory setup screen instead of
failing.

To make it persist anything, copy `.env.example` to `.env.local`, add your
Supabase project details, then create the tables:

```bash
npm run db:migrate      # creates 27 tables and their RLS policies
npm run db:verify-rls   # optional: proves accounts cannot see each other
```

## Commands

```bash
npm run dev             # development server
npm run build           # production build (validates content first)
npm run verify          # content + typecheck + lint + test
npm run content:check   # validate the curriculum, print a coverage report
npm run content:strict  # as above, warnings fail
npm test                # engine, schema and RLS-policy tests

npm run db:generate     # regenerate SQL migrations from the Drizzle schema
npm run db:migrate      # apply migrations (needs DATABASE_URL)
npm run db:verify-rls   # prove RLS isolates accounts, on a throwaway database
npm run db:studio       # browse the database
```

## Layout

```
content/            the curriculum — MDX, one file per lesson
docs/               architecture and decision records
scripts/            content validation
src/app/            routes (App Router)
src/components/     UI, grouped by domain
src/lib/content/    content loader, schema, validation
src/lib/domain/     skills and certification definitions
src/lib/db/         Drizzle schema, migrations, RLS policies
src/lib/engines/    pure scoring logic — XP, skills, certification,
                    unlocking, streaks, spaced repetition, agency finance
src/lib/queries/    data access, feeding raw rows into the engines
src/lib/supabase/   server and browser clients
src/proxy.ts        session refresh and route protection
```

## Ascend's pricing

Essential, Growth and Partner live in Settings, seeded with the real figures.
Every margin exercise, calculator and financial simulation reads those rows —
nothing hard-codes a price, so changing one there changes every downstream
number.

Each package separates **commitments** from **assumptions**:

- Setup and monthly price are customer-facing. Growth and Partner are "from"
  pricing and are rendered as a floor everywhere, never as a flat rate.
- Delivery hours, software cost and labour rate are internal planning
  assumptions. They stay flagged as unreviewed estimates until you tick that
  they have been checked against real delivery data.
- Third-party and usage-based costs — AI and API usage, voice minutes, phone
  numbers, SMS, CRM licences, domains, premium plugins and subscriptions — are
  billed separately by default, or covered by a defined allowance. They are
  never silently absorbed into the monthly fee.

## Writing a lesson

One MDX file per lesson. Ordering comes from the numeric filename prefix and is
stripped from the public slug.

```
content/terms/term-1/09-apis-and-webhooks/01-what-is-an-api.mdx
                └── term          └── module              └── lesson
→ /course/term-1/apis-and-webhooks/what-is-an-api
```

Frontmatter is validated on every build. A broken prerequisite, a quiz option
without an explanation, or an unknown skill key **fails the build** rather than
rendering as an empty panel.

Every lesson carries `status: draft | complete`. Draft lessons are visibly
labelled, excluded from certification requirements and excluded from completion
percentages — so the platform is never able to pass off a stub as a finished
lesson. `npm run content:check` prints exactly how much real content exists.
