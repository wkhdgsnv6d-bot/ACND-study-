# Security

What protects the data in this application, what was reviewed, and what is
knowingly accepted. The platform holds real business information — client
names, revenue figures, prospect notes — so this is not a formality.

---

## 1. The trust model

There is exactly one kind of caller: a signed-in account acting on its own
rows. There is no admin role, no shared workspace, and no server process that
acts on a user's behalf out of band.

That makes the security model narrow enough to state in full:

> Every read and write is scoped to `auth.uid()` by the database itself, and
> the application never holds a credential that can bypass that.

Everything below exists to keep that sentence true.

---

## 2. Defence in depth

Four independent layers. Any one of them failing does not, on its own, expose
another account's data.

| Layer | Where | What it stops |
|---|---|---|
| Route guard | `src/proxy.ts` | An unauthenticated browser reaching an application page |
| Action guard | every `"use server"` export | An unauthenticated *direct* call to a server action |
| Row-level security | all 27 tables | Any query returning or writing another account's rows |
| Least privilege | anon key + user JWT only | An application bug escalating beyond one account |

The ordering matters. The proxy is the *first* line, not the only one: it
guards page navigations, and a server action is an HTTP endpoint that a browser
can invoke directly without ever loading a page. So actions authenticate
themselves, and RLS backstops both.

### Enforced by tests, not by memory

Two properties are easy to break silently and are therefore asserted:

- **`src/lib/server-actions.test.ts`** — every exported function in a
  `"use server"` module calls `requireUser()`. `signIn` and `signUp` are the
  declared exceptions.
- **`src/lib/client-boundary.test.ts`** — no `"use client"` module reaches
  server-only code (`next/headers`, `node:fs`, the query layer, the Supabase
  server client) at any depth, through static or dynamic imports.

Both were written after the mistake they prevent had already happened.

### Row-level security is verified against a real database

`npm run db:verify-rls` starts Postgres, creates two accounts, and asserts that
the second cannot read, insert, update or delete the first's rows — that
cross-account `SELECT` returns nothing, `INSERT` is refused by `WITH CHECK`,
`UPDATE`/`DELETE` affect zero rows, and the victim's data is byte-for-byte
unchanged afterwards. It runs in CI. Policies are declared next to the tables in
`src/lib/db/schema.ts` via a shared `ownerPolicy()` helper, so a new table
cannot be added without one being visible in review.

---

## 3. Secrets

| Variable | Exposure | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Intended to be public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Powerless without a user JWT; RLS applies |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | **Bypasses RLS entirely** |
| `DATABASE_URL` | Server only | Migrations |
| `ANTHROPIC_API_KEY` | Server only | Optional; the assistant degrades without it |

Server secrets are reached through `serverEnv()` in `src/lib/env.ts`, which
throws if called in a browser. The service-role key is **never used by
application code** — it exists for migrations and admin scripts only. No code
path in `src/app` or `src/lib` reads it.

---

## 4. Headers

Set in `next.config.ts` (static) and `src/proxy.ts` (per request):

- **`Content-Security-Policy`** with a per-request nonce and `strict-dynamic`.
  Verified in a real browser across 20 routes with zero violations.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` and `frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` denying camera, microphone, geolocation, payment and USB
- `X-Powered-By` removed

### Two deliberate CSP decisions

**`style-src` allows `'unsafe-inline'`.** Progress bars, skill colours and the
study charts set width, height and background through the `style` attribute. A
nonce authorises `<style>` elements, not attributes, so no nonce can cover
them. Blocking them would break every meter in the application to defend
against an injection foothold this application does not offer: no user-supplied
content is ever rendered as HTML. Notes and client records render as text.

**Every page is server-rendered per request.** A nonce cannot be baked into
build-time HTML, so a prerendered page under `strict-dynamic` would have its own
bundle refused. The pages that were static — the sign-in forms, the setup
screen and the 404 — are cheap to render, and a private single-account tool has
nothing to gain from CDN caching. `/api/search-index` remains static: it is
JSON, contains no user data, and CSP does not apply to it.

---

## 5. Input handling

- Server actions parse their input with Zod before touching the database, and
  return typed failures rather than throwing.
- Quiz answers are graded **on the server**; the correct answers are stripped
  from the payload before questions reach the browser (`src/lib/quiz.ts`).
- Lesson completion re-checks stored scroll depth, dwell time and prerequisites
  server-side. The client's claim that a lesson was read is never trusted.
- The auth callback validates its `next` parameter as a same-site relative path
  before redirecting. An open redirect on an authentication endpoint is where
  they do the most damage.
- All money is stored and computed in whole cents; no float arithmetic reaches
  a stored figure.

---

## 6. Data ownership

`GET /api/export` returns all 27 tables as JSON for the signed-in account.
Being able to take the data out is a condition of trusting the platform with
anything that matters. The route reports per-table failures in an `incomplete`
field rather than silently returning a short export — an export you cannot
trust the completeness of is worse than no export.

---

## 7. Known and accepted

Stated plainly rather than left for someone to discover.

- **`npm audit` reports 4 moderate advisories**, all from `esbuild` reached
  through `drizzle-kit`. `drizzle-kit` is a development dependency used to
  generate and run migrations; it is not part of the deployed application, and
  the advisory concerns esbuild's development server. `npm audit fix --force`
  would downgrade `drizzle-kit` across a major version. Accepted, and worth
  re-checking whenever `drizzle-kit` releases.
- **No rate limiting on sign-in.** Supabase applies its own limits to the auth
  endpoints, which is where the attempts land. Worth revisiting if the platform
  ever serves more than its owner.
- **No audit log of reads.** Writes are recorded in `activity_log`; reads are
  not. For a single-account tool there is nobody to audit.
- **Session lifetime is Supabase's default.** Not tuned.
- **The AI Study Assistant sends lesson context to Anthropic** when configured.
  It is off unless `ANTHROPIC_API_KEY` is set, and it never sends client
  records, revenue figures or notes.

---

## 8. Legal content

The Template Vault generates commercial documents — proposals, scopes of work,
service agreements. These are **starting points drafted for an operator to take
to a solicitor, not legal advice, and not a substitute for professionally
drafted documents.** Templates carrying real legal exposure are flagged with
`requiresLegalReview` and render that warning in the interface. The platform
does not claim, anywhere, that its output is fit to sign as-is.

---

## 9. Reporting

This is a private single-operator application. If you are reading this because
you found something, open an issue with enough detail to reproduce it.
