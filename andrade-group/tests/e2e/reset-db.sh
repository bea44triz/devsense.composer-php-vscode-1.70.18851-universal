#!/usr/bin/env bash
# Recria só o banco do E2E (mantém PostgREST, gateway e Next no ar).
set -euo pipefail
cd "$(dirname "$0")/../.."
dropdb --force --if-exists erp_e2e; createdb erp_e2e
psql -X -q -v ON_ERROR_STOP=1 -d erp_e2e -f supabase/tests/local/supabase_shim.sql >/dev/null
for m in supabase/migrations/*.sql; do psql -X -q -v ON_ERROR_STOP=1 -d erp_e2e -f "$m" >/dev/null; done
psql -X -q -v ON_ERROR_STOP=1 -d erp_e2e -f tests/e2e/seed.sql >/dev/null
rm -rf /var/tmp/fake-storage
echo "banco erp_e2e recriado"
