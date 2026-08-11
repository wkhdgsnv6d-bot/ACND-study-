-- Stand-in for the parts of a Supabase project the migration depends on:
-- the auth schema, auth.users, auth.uid(), and the anon/authenticated roles.
-- Applied before the migrations by scripts/verify-rls.sh.

\set ON_ERROR_STOP on

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
end $$;

grant usage on schema public to anon, authenticated;

