# Launch

Getting Ascend Business Mastery from this repository to something you use every
day. Roughly 90 minutes end to end, most of it waiting for things to deploy.

Steps 1–6 get it running on your machine against a real database. Steps 7–9 put
it on the internet. Step 10 is what to check afterwards.

Nothing here has been done yet — the platform has only ever run against local
test doubles. Expect to hit at least one thing this document does not predict.

---

## Before you start

| You need | Notes |
|---|---|
| Node 22 | CI runs 22. Older versions may work; nothing has verified that. |
| A Supabase account | Free tier is enough. https://supabase.com |
| A Vercel account | Free tier is enough. Any Next.js host works; Vercel is assumed below. |
| An Anthropic API key | Optional. The study assistant degrades to an explanatory card without it. |

---

## 1. Create the Supabase project

1. https://supabase.com/dashboard → **New project**.
2. Choose a region close to you — this is where your data lives, and latency on
   every page load runs through it.
3. Set a database password and **save it somewhere permanent**. You need it in
   step 3 and Supabase will not show it again.
4. Wait for provisioning, about two minutes.

---

## 2. Collect the credentials

**Project Settings → API:**

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Project Settings → Database → Connection string:**

- Take the **direct** connection URI (not the pooled one) → `DATABASE_URL`
- Substitute the password from step 1 into it.

> **Why direct, not pooled.** The pooler runs in transaction mode, which cannot
> run the schema changes a migration performs. Use the direct URI for
> migrations. It is only ever used from your machine — see step 8.

You do **not** need the service-role key. It exists in `.env.example` for
completeness and no application code reads it.

---

## 3. Configure locally

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Leave `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` empty for now.

`.env.local` is gitignored and must stay that way. It holds credentials to a
database that will contain real client information.

---

## 4. Create the tables

```bash
npm install
npm run db:migrate
```

This applies the two migrations in `drizzle/`, creating 27 tables with
row-level security policies on every one.

Then prove the isolation is real:

```bash
npm run db:verify-rls
```

This creates two accounts and asserts the second cannot read, insert, update or
delete the first's rows. It has passed against a local Postgres 16 cluster; this
is the first time it will run against your actual project, which is the point.

**If it fails, stop.** Do not put real client data into a database whose
isolation has not been proven.

---

## 5. Configure authentication

**Authentication → URL Configuration:**

- **Site URL**: `http://localhost:3000` for now.
- **Redirect URLs**: add `http://localhost:3000/auth/callback`

The signup flow sends users to `${NEXT_PUBLIC_SITE_URL}/auth/callback`, and
Supabase refuses to redirect anywhere not on this list.

### Decide about email confirmation

**Authentication → Sign In / Providers → Email** has *Confirm email* on by
default. Two reasonable choices:

- **Leave it on.** More realistic, and you must click a link in an email before
  your first sign-in works.
- **Turn it off.** This is a private single-operator tool. Turning it off makes
  signup immediate and removes a moving part.

If you leave it on and the email never arrives, Supabase's built-in mailer is
rate-limited and unreliable for real use — turn confirmation off, or configure
SMTP under **Project Settings → Authentication → SMTP**.

---

## 6. Run it

```bash
npm run dev
```

Then, in order:

1. **http://localhost:3000** → redirects to `/login`.
2. **Create an account** at `/signup`. If confirmation is on, click the link in
   the email first.
3. **Land on `/dashboard`.** If you see `/setup` instead, the environment
   variables are not being read — restart `npm run dev` after editing
   `.env.local`.
4. **Open `/settings`.** This is the step that matters: loading it creates your
   profile, your settings row, and your three pricing packages seeded with the
   real Essential / Growth / Partner figures. Nothing else creates them.
5. **Check the pricing.** Confirm Essential, Growth and Partner match what you
   actually charge, and mark the delivery-hours and software-cost assumptions
   reviewed once you have checked them against real jobs.
6. **Read a lesson** at `/course/term-1/apis-and-webhooks/what-is-an-api` and
   complete it. Reading progress needs 85% scroll and real dwell time, so this
   also confirms progress tracking is writing to the database.

If all six work, the platform is live against a real database.

---

## 7. Push to GitHub

The branch is `claude/ascend-business-mastery-gkduzc`. Merge it to your default
branch, or point Vercel at it directly — either is fine for a private tool.

CI runs content validation, typecheck, lint and 349 tests on every push.

---

## 8. Deploy

1. https://vercel.com → **Add New → Project** → import the repository.
2. Framework preset: **Next.js**. Nothing else needs changing.
3. **Environment variables** — add exactly these three:

   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   NEXT_PUBLIC_SITE_URL     ← your production URL, e.g. https://ascend.yourdomain.com
   ```

4. Deploy.

> **Do not add `DATABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` to production.**
> No runtime code reads either. `DATABASE_URL` is for migrations you run from
> your machine, and the service-role key bypasses row-level security entirely.
> A credential that is not deployed cannot leak from the deployment.

### Then update Supabase for the new domain

**Authentication → URL Configuration:**

- **Site URL** → your production URL
- **Redirect URLs** → add `https://your-domain/auth/callback` (keep the
  localhost entry so development still works)

Miss this and sign-in fails in production while working perfectly locally.

---

## 9. Optional: the study assistant

1. Get a key at https://console.anthropic.com
2. Add `ANTHROPIC_API_KEY` to `.env.local` and to Vercel's environment
   variables. It is server-only — no `NEXT_PUBLIC_` prefix.
3. Redeploy.
4. **Test that it refuses.** Open a lesson, and ask the assistant for the answer
   to the knowledge check. It should decline and teach the concept instead.

That refusal has only ever been tested against a local stub. If it complies, the
system prompt in `src/lib/ai/assistant.ts` needs work — tell me and I will fix
it.

---

## 10. After launch

### Turn on backups

**Project Settings → Database → Backups.** The free tier gives daily backups
with 7-day retention; paid plans give point-in-time recovery. This database will
hold your client pipeline and revenue records. Decide deliberately, now, rather
than after losing something.

`GET /api/export` returns all 27 tables as JSON for your account at any time —
that is a data-portability guarantee, not a backup strategy.

### Know what does not work yet

Three certification requirements cannot currently be satisfied, so **no
certification can be earned**:

| Requirement | Status |
|---|---|
| Module exams | Not built. No route, no UI. Every certification requires one. |
| Labs | 6 exist; several referenced by certifications do not. |
| Assignments | Referenced by id in `certifications.ts`; no assignment content exists. |

Everything else works: lessons, quizzes, practical submissions, notes, spaced
repetition, the skill tree, projects, and the whole business side — pipeline,
revenue, market validation and the margin calculators.

Curriculum coverage is 2 modules of roughly 40. `npm run content:check` prints
exactly what exists, and draft lessons never count toward anything.

### Routine commands

```bash
npm run verify           # content + typecheck + lint + tests, before any push
npm run content:check    # curriculum coverage report
npm run db:generate      # after editing src/lib/db/schema.ts
npm run db:migrate       # apply migrations (needs DATABASE_URL)
npm run db:verify-rls    # re-prove account isolation
```

### If something breaks

- **Everything redirects to `/setup`** → Supabase environment variables are
  missing or unreadable. Check the deployment's environment, then redeploy —
  `NEXT_PUBLIC_*` values are inlined at build time, so editing them requires a
  rebuild, not just a restart.
- **Sign-in works locally, fails in production** → the production callback URL
  is not in Supabase's redirect allowlist (step 8).
- **Pages load but no data saves** → open the browser console. A row-level
  security refusal returns an empty result rather than an error, so check the
  Supabase logs under **Logs → Postgres**.
- **A lesson will not mark complete** → that is working as designed. It requires
  85% scroll depth and real dwell time, re-checked server-side.
