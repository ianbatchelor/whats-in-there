#!/usr/bin/env bash
# Applies every migration to a fresh PostgreSQL 16 database (with a small Supabase shim) and runs
# the SQL tests. Uses $DATABASE_URL if set (CI), otherwise starts a throwaway local cluster.
set -euo pipefail
cd "$(dirname "$0")/.."

cleanup() { :; }
if [[ -z "${DATABASE_URL:-}" ]]; then
  PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
  DIR="$(mktemp -d)"; PORT="${PGPORT_TEST:-54329}"
  RUN=(); [[ "$(id -u)" == "0" ]] && { chown -R postgres "$DIR"; RUN=(runuser -u postgres --); }
  "${RUN[@]}" "$PGBIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
  cleanup() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
  DATABASE_URL="postgresql://postgres@/postgres?host=$DIR&port=$PORT"
fi
trap cleanup EXIT

PSQL=(psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f supabase/tests/00_supabase_shim.sql 2>&1 | grep -v -e wal_level -e "Set wal_level" || true
for f in supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -f supabase/tests/10_helpers.sql
for f in supabase/tests/[2-9]*.sql; do
  echo "test     $(basename "$f")"
  "${PSQL[@]}" -o /dev/null -f "$f" 2>&1 | sed -e 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /'
  [[ ${PIPESTATUS[0]} -eq 0 ]] || exit 1
done
