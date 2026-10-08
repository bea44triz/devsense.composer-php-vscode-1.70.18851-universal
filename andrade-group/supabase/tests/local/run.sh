#!/usr/bin/env bash
# Aplica todas as migrations num banco Postgres LOCAL descartável e roda os testes SQL.
# Não toca em nenhum projeto Supabase remoto.
#
# Uso: PGHOST=/var/tmp PGPORT=54329 PGUSER=postgres supabase/tests/local/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${TEST_DB:-erp_test_$$}"
PSQL="psql -X -q -v ON_ERROR_STOP=1"

createdb "$DB"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT

$PSQL -d "$DB" -f tests/local/supabase_shim.sql >/dev/null
for m in migrations/*.sql; do
  echo "migration: $m"
  $PSQL -d "$DB" -f "$m" >/dev/null
done

fail=0
for t in tests/isolation_fase1.sql tests/marco1_fluxo_evento.sql tests/marco2_seguranca_pontos_fixos.sql tests/marco3_usuarios_e_ip.sql tests/security_checks.sql; do
  echo; echo "== $t"
  out="$($PSQL -A -F ' | ' -P footer=off -d "$DB" -f "$t" 2>&1 | grep -E '^(PASSOU|FALHOU|resultado)' || true)"
  echo "$out"
  total=$(grep -cE '^(PASSOU|FALHOU)' <<<"$out" || true)
  bad=$(grep -c '^FALHOU' <<<"$out" || true)
  echo "-- $((total - bad))/$total passaram"
  [ "$total" -gt 0 ] && [ "$bad" -eq 0 ] || fail=1
done
exit $fail
