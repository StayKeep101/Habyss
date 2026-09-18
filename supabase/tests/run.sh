#!/bin/sh
# Tests a migration against a local copy of the production schema, as the roles
# Supabase uses, before it goes anywhere near the real database.
#
#   ./supabase/tests/run.sh                                  # newest migration
#   ./supabase/tests/run.sh supabase/migrations/<file>.sql   # a specific one
#
# Needs Postgres 17 (brew install postgresql@17). Builds a throwaway cluster,
# loads the schema snapshot plus the legacy policies that leaked emails, runs the
# migration twice to prove it is re-runnable, then checks the security rules.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
MIGRATION="${1:-$(ls "$ROOT"/supabase/migrations/*.sql | sort | tail -1)}"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
PORT="${PORT:-54329}"
DATA="$(mktemp -d)"

"$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" -l "$DATA/log" start >/dev/null
trap '"$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null; rm -rf "$DATA"' EXIT
sleep 2

Q="$DATA/q"
printf '#!/bin/sh\nexec "%s/psql" -h 127.0.0.1 -p %s -U postgres -v ON_ERROR_STOP=1 -q "$@"\n' "$PGBIN" "$PORT" > "$Q"
chmod +x "$Q"
export Q

"$Q" -c "create database replica;"
for f in 00_supabase_stub 01_schema_snapshot 02_seed_and_legacy_policies; do
    "$Q" -d replica -f "$HERE/$f.sql"
done

echo "Migration: $(basename "$MIGRATION")"
"$Q" -d replica -f "$MIGRATION" >/dev/null 2>&1 && echo "  first run ok"
"$Q" -d replica -f "$MIGRATION" >/dev/null 2>&1 && echo "  second run ok (re-runnable)"

sh "$HERE/rls_test.sh"
