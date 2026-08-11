-- Row-level security verification.
--
-- Applies the generated migration to a throwaway Postgres database and proves
-- that two accounts genuinely cannot reach each other's data. The unit test in
-- `src/lib/db/rls.test.ts` checks that the policies were *written*; this checks
-- that they *work*, which is not the same claim.
--
--   npm run db:verify-rls
--
-- Requires a local Postgres. See the script in package.json for the harness.

\set ON_ERROR_STOP on

-- Supabase grants table privileges to `authenticated` through default
-- privileges. Replicate that so this exercises RLS, not a missing GRANT.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

-- ------------------------------------------------------------------------
-- Two accounts, one row each.
-- ------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

insert into notes (user_id, title, body_md) values
  ('11111111-1111-1111-1111-111111111111', 'A private note', 'a'),
  ('22222222-2222-2222-2222-222222222222', 'B private note', 'b');

insert into prospects (user_id, company) values
  ('11111111-1111-1111-1111-111111111111', 'Alice Plumbing'),
  ('22222222-2222-2222-2222-222222222222', 'Bob Electrical');

insert into revenue_entries (user_id, type, amount_cents, incurred_on) values
  ('11111111-1111-1111-1111-111111111111', 'project', 500000, current_date),
  ('22222222-2222-2222-2222-222222222222', 'project', 900000, current_date);

-- ------------------------------------------------------------------------
-- Assertions. Any failure aborts with a non-zero exit code.
-- ------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  visible int;
  revenue bigint;
begin
  select count(*) into visible from notes;
  if visible <> 1 then
    raise exception 'READ ISOLATION FAILED: user A sees % notes, expected 1', visible;
  end if;

  select count(*) into visible from prospects;
  if visible <> 1 then
    raise exception 'READ ISOLATION FAILED: user A sees % prospects, expected 1', visible;
  end if;

  select coalesce(sum(amount_cents), 0) into revenue from revenue_entries;
  if revenue <> 500000 then
    raise exception 'READ ISOLATION FAILED: user A sees revenue of %, expected 500000', revenue;
  end if;

  raise notice 'PASS  reads are isolated to the signed-in account';
end $$;

do $$ begin
  begin
    insert into notes (user_id, title)
      values ('22222222-2222-2222-2222-222222222222', 'forged');
    raise exception 'WRITE ISOLATION FAILED: cross-account insert succeeded';
  exception when insufficient_privilege then
    raise notice 'PASS  cross-account insert blocked by WITH CHECK';
  end;
end $$;

do $$
declare changed int;
begin
  with hijack as (
    update notes set title = 'hijacked'
    where user_id = '22222222-2222-2222-2222-222222222222'
    returning 1
  )
  select count(*) into changed from hijack;

  if changed <> 0 then
    raise exception 'WRITE ISOLATION FAILED: user A updated % of B''s rows', changed;
  end if;
  raise notice 'PASS  cross-account update affects no rows';
end $$;

do $$
declare removed int;
begin
  with wipe as (
    delete from notes
    where user_id = '22222222-2222-2222-2222-222222222222'
    returning 1
  )
  select count(*) into removed from wipe;

  if removed <> 0 then
    raise exception 'WRITE ISOLATION FAILED: user A deleted % of B''s rows', removed;
  end if;
  raise notice 'PASS  cross-account delete affects no rows';
end $$;

reset role;

do $$
declare surviving int;
begin
  select count(*) into surviving from notes
  where user_id = '22222222-2222-2222-2222-222222222222'
    and title = 'B private note';

  if surviving <> 1 then
    raise exception 'DATA LOSS: user B''s row did not survive user A''s attempts';
  end if;
  raise notice 'PASS  user B''s data is intact';
end $$;

set role anon;
do $$
declare n int;
begin
  select count(*) into n from notes;
  if n > 0 then
    raise exception 'ANON LEAK: the anonymous role read % rows', n;
  end if;
  raise notice 'PASS  anonymous role sees no rows';
exception when insufficient_privilege then
  raise notice 'PASS  anonymous role has no privileges on the table at all';
end $$;
reset role;

\echo ''
\echo 'Row-level security verified.'
