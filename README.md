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

**Phase 1 complete** — design system, content pipeline and scoring engines.
Phase 2 (database, authentication, application shell, dashboard) is next.
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full plan and the
reasoning behind each decision.

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Styling | Tailwind CSS v4, dark-first design tokens |
| Content | MDX with Zod-validated frontmatter |
| Data | Supabase Postgres with row-level security *(Phase 2)* |
| Tests | 134 passing across 8 suites |

---

## Getting started

```bash
npm install
npm run dev
```

Phase 1 needs no credentials. `dev`, `build` and `test` all work without a
`.env.local`. From Phase 2, copy `.env.example` to `.env.local` and add your
Supabase project details.

## Commands

```bash
npm run dev             # development server
npm run build           # production build (validates content first)
npm run verify          # content + typecheck + lint + test
npm run content:check   # validate the curriculum, print a coverage report
npm run content:strict  # as above, warnings fail
npm test                # engine and schema tests
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
src/lib/engines/    pure scoring logic — XP, skills, certification,
                    unlocking, streaks, spaced repetition, agency finance
```

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
