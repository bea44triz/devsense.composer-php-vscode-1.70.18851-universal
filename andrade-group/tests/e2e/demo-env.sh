#!/usr/bin/env bash
# Deve ser "sourced" (não executado): define os padrões da pilha local da demo e trava contra qualquer
# ambiente que não seja 100% local. Usado por demo-up.sh e demo-reset.sh.
set -euo pipefail

# Padrões do Postgres local descartável (só aplicados se quem chamou não tiver passado outro valor).
export PGHOST="${PGHOST:-/var/tmp}"
export PGPORT="${PGPORT:-54329}"
export PGUSER="${PGUSER:-postgres}"
export POSTGREST_BIN="${POSTGREST_BIN:-/var/tmp/pgrst/postgrest}"
export PGDATA_DEMO="${PGDATA_DEMO:-/var/tmp/pgdata_erp}"

_abort() { echo "ABORTADO — $1" >&2; echo "A demo só roda contra o Postgres local descartável. Nada foi alterado." >&2; exit 2; }

# 1) Nunca contra um host que não seja o Postgres local da demo.
case "$PGHOST" in
  /var/tmp|localhost|127.0.0.1) ;;
  *) _abort "PGHOST='$PGHOST' não é o Postgres local esperado (/var/tmp, localhost ou 127.0.0.1)." ;;
esac

# 2) Nenhuma variável de ambiente já apontando para um projeto Supabase remoto (staging ou produção).
for v in NEXT_PUBLIC_SUPABASE_URL SUPABASE_URL STAGING_SUPABASE_URL PRODUCTION_REF; do
  val="${!v:-}"
  if [ -n "$val" ] && [[ "$val" == *supabase.co* || "$val" == *PRODUCTION* ]]; then
    _abort "a variável $v já aponta para um projeto remoto ('$val'). Remova-a do ambiente antes de rodar a demo."
  fi
done

# 3) Nenhum indício de ambiente de produção/deploy.
for v in VERCEL VERCEL_ENV NODE_ENV; do
  val="${!v:-}"
  if [ "$val" = "production" ]; then _abort "variável $v=production detectada — isto não é o ambiente da demo."; fi
done

# 4) Sobe o Postgres local se ele não estiver respondendo (idempotente).
if ! pg_isready -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1; then
  echo "Postgres local não respondia em $PGHOST:$PGPORT — iniciando…"
  su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D '$PGDATA_DEMO' -o '-p $PGPORT -k $PGHOST' -l /var/tmp/pg_erp.log start" || true
  for _ in $(seq 1 20); do pg_isready -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1 && break; sleep 0.5; done
  pg_isready -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1 || _abort "não consegui iniciar o Postgres local (veja /var/tmp/pg_erp.log)."
fi
echo "ambiente local confirmado: Postgres em $PGHOST:$PGPORT"
