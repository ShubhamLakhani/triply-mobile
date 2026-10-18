#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Runs every migration + every pgTAP test in supabase/tests/database on a
# throwaway PLAIN PostgreSQL cluster (no Docker, no Supabase stack).
#
#   npm run test:db
#
# Prerequisites (nothing is installed into the server):
#   * PostgreSQL 15+ server binaries (initdb, pg_ctl, postgres, psql, pg_config).
#     Found in this order: $PG_BIN, PATH, Postgres.app, Homebrew postgresql@17/16,
#     /usr/lib/postgresql/<ver>/bin.
#   * pgTAP. If the server already has the extension (e.g. apt
#     `postgresql-<ver>-pgtap` on CI) it is used via CREATE EXTENSION. Otherwise
#     pgTAP $PGTAP_VERSION is fetched once from GitHub into .cache/db-test/ and
#     built there (plain SQL, `make` + perl only); the SQL is loaded into the
#     throwaway database. Postgres.app / Homebrew installs are never modified.
#
# The cluster lives in a temp dir on a private Unix socket (no TCP) and is
# deleted on exit. This approximates Supabase with scripts/db-test/supabase-shim.sql;
# the real local stack (`npx supabase test db`) remains the authoritative check.
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${DB_TEST_PORT:-54399}"
PGTAP_VERSION="${PGTAP_VERSION:-v1.3.3}"
CACHE_DIR="$ROOT/.cache/db-test"

find_pg_bin() {
  if [ -n "${PG_BIN:-}" ]; then echo "$PG_BIN"; return; fi
  if command -v initdb >/dev/null 2>&1; then dirname "$(command -v initdb)"; return; fi
  local candidate
  for candidate in \
    /Applications/Postgres.app/Contents/Versions/latest/bin \
    /opt/homebrew/opt/postgresql@17/bin /usr/local/opt/postgresql@17/bin \
    /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin; do
    if [ -x "$candidate/initdb" ]; then echo "$candidate"; return; fi
  done
  for candidate in $(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -rV); do
    if [ -x "$candidate/initdb" ]; then echo "$candidate"; return; fi
  done
  return 1
}

if ! PG_BIN="$(find_pg_bin)"; then
  echo "PostgreSQL server binaries not found." >&2
  echo "Install Postgres.app (https://postgresapp.com) or 'brew install postgresql@17'," >&2
  echo "or set PG_BIN to the directory containing initdb." >&2
  exit 1
fi
PG_CONFIG="$PG_BIN/pg_config"
echo "→ PostgreSQL: $("$PG_BIN/postgres" --version) ($PG_BIN)"

# pgTAP: the server's own extension if present, else the pinned local build.
PGTAP_SQL=""
if [ ! -f "$("$PG_CONFIG" --sharedir)/extension/pgtap.control" ]; then
  PGTAP_DIR="$CACHE_DIR/pgtap-$PGTAP_VERSION"
  PGTAP_SQL="$PGTAP_DIR/sql/pgtap.sql"
  if [ ! -f "$PGTAP_SQL" ]; then
    echo "→ building pgTAP $PGTAP_VERSION in .cache/db-test (one-time)"
    mkdir -p "$CACHE_DIR"
    if [ ! -d "$PGTAP_DIR" ]; then
      git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$PGTAP_VERSION" \
        https://github.com/theory/pgtap.git "$PGTAP_DIR"
    fi
    (cd "$PGTAP_DIR" && PATH="$PG_BIN:$PATH" make PG_CONFIG="$PG_CONFIG" >/dev/null)
  fi
  echo "→ pgTAP: local build $PGTAP_VERSION"
else
  echo "→ pgTAP: server extension"
fi

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/triply-db-test.XXXXXX")"
DATA="$WORKDIR/data"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $WORKDIR -c listen_addresses=''" -l "$WORKDIR/log" -w start >/dev/null

PSQL=("$PG_BIN/psql" -h "$WORKDIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q)
"${PSQL[@]}" -c 'alter database postgres set search_path = "$user", public, extensions'

echo "→ Supabase shim"
"${PSQL[@]}" -f "$ROOT/scripts/db-test/supabase-shim.sql" >/dev/null
if [ -n "$PGTAP_SQL" ]; then
  # Same placement as the extension: every pgTAP object lives in schema extensions.
  "${PSQL[@]}" -c 'set search_path = extensions' -f "$PGTAP_SQL" >/dev/null
else
  "${PSQL[@]}" -c 'create extension pgtap with schema extensions' >/dev/null
fi

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migration $(basename "$migration")"
  "${PSQL[@]}" -f "$migration" >/dev/null
done

# Applied twice on purpose: the seed must be idempotent (verified by seed.test.sql).
echo "→ seed.sql (x2)"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql" >/dev/null

status=0
passed=0
failed=0
for test in "$ROOT"/supabase/tests/database/*.test.sql; do
  echo "→ test $(basename "$test")"
  if [ -n "$PGTAP_SQL" ]; then
    # Test files keep `create extension if not exists pgtap` for `supabase test db`; with the
    # preloaded local build that line is replaced by a comment (line numbers unchanged).
    output="$(sed 's/^create extension if not exists pgtap with schema extensions;$/-- pgtap preloaded by run.sh/' "$test" \
      | "${PSQL[@]}" -t -A -f - 2>&1)" || status=1
  else
    output="$("${PSQL[@]}" -t -A -f "$test" 2>&1)" || status=1
  fi
  echo "$output" | sed 's/^/    /'
  passed=$((passed + $(echo "$output" | grep -cE '^ok ' || true)))
  failed=$((failed + $(echo "$output" | grep -cE '^not ok ' || true)))
  if echo "$output" | grep -qE '^(not ok|# Looks like|psql:.*ERROR)'; then
    status=1
  fi
done

echo "pgTAP assertions: $passed passed, $failed failed"
if [ "$status" -ne 0 ]; then
  echo "Database tests FAILED"
  exit 1
fi
echo "Database tests passed."
