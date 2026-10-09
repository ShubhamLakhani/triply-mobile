#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Runs every migration + every pgTAP test in supabase/tests/database on a
# throwaway PLAIN PostgreSQL cluster (no Docker, no Supabase stack).
#
#   npm run test:db
#
# Requires PostgreSQL 15+ server binaries (initdb, pg_ctl, postgres, psql) and
# the pgTAP extension installed for that server:
#   macOS:  brew install postgresql@17 pgtap
#   Ubuntu: apt-get install postgresql postgresql-<ver>-pgtap
# Set PG_BIN to the server's bin directory if it is not on PATH.
#
# This approximates Supabase with scripts/db-test/supabase-shim.sql. The real
# local stack (`npx supabase test db`) is the authoritative check.
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || echo /usr/lib/postgresql/16/bin/initdb)")}"
PORT="${DB_TEST_PORT:-54399}"
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/triply-db-test.XXXXXX")"
DATA="$WORKDIR/data"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $WORKDIR -c listen_addresses=''" -l "$WORKDIR/log" -w start >/dev/null

PSQL=(psql -h "$WORKDIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q)
"${PSQL[@]}" -c 'alter database postgres set search_path = "$user", public, extensions'

echo "→ Supabase shim"
"${PSQL[@]}" -f "$ROOT/scripts/db-test/supabase-shim.sql" >/dev/null

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migration $(basename "$migration")"
  "${PSQL[@]}" -f "$migration" >/dev/null
done

status=0
for test in "$ROOT"/supabase/tests/database/*.test.sql; do
  echo "→ test $(basename "$test")"
  output="$("${PSQL[@]}" -t -A -f "$test" 2>&1)" || status=1
  echo "$output" | sed 's/^/    /'
  if echo "$output" | grep -qE '^(not ok|# Looks like|psql:.*ERROR)'; then
    status=1
  fi
done

if [ "$status" -ne 0 ]; then
  echo "Database tests FAILED"
  exit 1
fi
echo "Database tests passed."
