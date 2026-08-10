#!/usr/bin/env bash
#
# Proves row-level security actually isolates accounts, by applying the
# generated migration to a throwaway Postgres database and attempting real
# cross-account reads and writes.
#
#   npm run db:verify-rls
#
# Uses $PGTEST_URL if set (any scratch Postgres will do — never point this at a
# database you care about, it drops and recreates its schema). Otherwise it
# starts a temporary local cluster and cleans it up afterwards.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PGTEST_PORT:-5433}"
DB="ascend_rls_check"

if [[ -n "${PGTEST_URL:-}" ]]; then
  echo "Using PGTEST_URL"
  psql "$PGTEST_URL" -v ON_ERROR_STOP=1 -q -c "drop schema if exists public cascade; create schema public;"
  psql "$PGTEST_URL" -v ON_ERROR_STOP=1 -q -f "$SCRIPT_DIR/verify-rls.sql"
  exit 0
fi

PGBIN="${PGBIN:-}"
if [[ -z "$PGBIN" ]]; then
  for candidate in /usr/lib/postgresql/*/bin /usr/local/pgsql/bin /opt/homebrew/opt/postgresql@16/bin; do
    if [[ -x "$candidate/initdb" ]]; then PGBIN="$candidate"; break; fi
  done
fi

if [[ -z "$PGBIN" || ! -x "$PGBIN/initdb" ]]; then
  echo "No local Postgres found. Install one, or set PGTEST_URL to a scratch database." >&2
  exit 1
fi

PGDATA="$(mktemp -d)/data"
SOCKET_DIR="$(mktemp -d)"

cleanup() {
  "$PGBIN/pg_ctl" -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$PGDATA" "$SOCKET_DIR"
}
trap cleanup EXIT

"$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PORT -k $SOCKET_DIR -c listen_addresses=''" -l "$PGDATA/server.log" start >/dev/null

psql -h "$SOCKET_DIR" -p "$PORT" -U postgres -q -c "create database $DB;"
psql -h "$SOCKET_DIR" -p "$PORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f "$SCRIPT_DIR/verify-rls.sql"
