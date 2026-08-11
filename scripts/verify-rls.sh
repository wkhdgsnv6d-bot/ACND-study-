#!/usr/bin/env bash
#
# Proves row-level security actually isolates accounts, by applying every
# generated migration to a throwaway Postgres database and attempting real
# cross-account reads and writes.
#
#   npm run db:verify-rls
#
# Uses $PGTEST_URL if set (any scratch Postgres will do — never point this at a
# database you care about, it drops and recreates its public schema). Otherwise
# it starts a temporary local cluster and cleans it up afterwards.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT="${PGTEST_PORT:-5433}"
DB="ascend_rls_check"

# Migrations are applied in filename order, which is the order drizzle-kit
# generates them in.
migrations() {
  find "$REPO_DIR/drizzle" -maxdepth 1 -name '*.sql' | sort
}

run_suite() {
  local psql_target=("$@")
  psql "${psql_target[@]}" -v ON_ERROR_STOP=1 -q -f "$SCRIPT_DIR/rls-shim.sql"
  local migration
  while IFS= read -r migration; do
    psql "${psql_target[@]}" -v ON_ERROR_STOP=1 -q -f "$migration"
  done < <(migrations)
  psql "${psql_target[@]}" -v ON_ERROR_STOP=1 -q -f "$SCRIPT_DIR/verify-rls.sql"
}

if [[ -n "${PGTEST_URL:-}" ]]; then
  echo "Using PGTEST_URL"
  psql "$PGTEST_URL" -v ON_ERROR_STOP=1 -q \
    -c "drop schema if exists public cascade; create schema public;"
  run_suite "$PGTEST_URL"
  exit 0
fi

PGBIN="${PGBIN:-}"
if [[ -z "$PGBIN" ]]; then
  for candidate in /usr/lib/postgresql/*/bin /usr/local/pgsql/bin \
                   /opt/homebrew/opt/postgresql@*/bin /usr/local/opt/postgresql@*/bin; do
    if [[ -x "$candidate/initdb" ]]; then PGBIN="$candidate"; fi
  done
fi

if [[ -z "$PGBIN" || ! -x "$PGBIN/initdb" ]]; then
  echo "No local Postgres found. Install one, or set PGTEST_URL to a scratch database." >&2
  exit 1
fi

if [[ "$(id -u)" == "0" ]]; then
  echo "Postgres refuses to run as root. Re-run as an unprivileged user, or set PGTEST_URL." >&2
  exit 1
fi

WORKDIR="$(mktemp -d)"
PGDATA="$WORKDIR/data"
SOCKET_DIR="$WORKDIR/socket"
mkdir -p "$SOCKET_DIR"

cleanup() {
  "$PGBIN/pg_ctl" -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

"$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$PGDATA" \
  -o "-p $PORT -k $SOCKET_DIR -c listen_addresses=''" \
  -l "$PGDATA/server.log" start >/dev/null

psql -h "$SOCKET_DIR" -p "$PORT" -U postgres -q -c "create database $DB;"
run_suite -h "$SOCKET_DIR" -p "$PORT" -U postgres -d "$DB"
