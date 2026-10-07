#!/usr/bin/env bash
# Regera src/lib/supabase/database.types.ts a partir das migrations, num Postgres LOCAL descartável.
# Requer: Postgres local (PGHOST/PGPORT/PGUSER) e Node. Não acessa projeto remoto.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=erp_types_$$
createdb "$DB"; trap 'dropdb --if-exists "$DB"' EXIT
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/local/supabase_shim.sql >/dev/null
for m in supabase/migrations/*.sql; do psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$m" >/dev/null; done
TMP=$(mktemp -d); (cd "$TMP" && npm install --silent --no-audit --no-fund @supabase/postgres-meta@0.91.6 >/dev/null)
OUT=src/lib/supabase/database.types.ts
{ echo "// Gerado a partir das migrations em supabase/migrations (postgres-meta). Não editar à mão: rode supabase/gen-types.sh."
  PG_META_DB_HOST="${PGHOST:-localhost}" PG_META_DB_PORT="${PGPORT:-5432}" PG_META_DB_USER="${PGUSER:-postgres}" PG_META_DB_NAME="$DB" \
  PG_META_DB_URL="postgresql://${PGUSER:-postgres}@127.0.0.1:${PGPORT:-5432}/$DB" \
  PG_META_GENERATE_TYPES=typescript PG_META_GENERATE_TYPES_INCLUDED_SCHEMAS=public node "$TMP/node_modules/@supabase/postgres-meta/dist/server/server.js"; } > "$OUT"
rm -rf "$TMP"; echo "tipos gerados em $OUT"
