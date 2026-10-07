#!/usr/bin/env bash
# Sobe uma pilha 100% LOCAL para o teste ponta a ponta: Postgres (migrations + seed) → PostgREST → gateway fake → Next.
# Não usa nenhum projeto Supabase remoto. Requer: Postgres local (PGHOST/PGPORT/PGUSER), binário do PostgREST (POSTGREST_BIN).
# Uso:  PGHOST=/var/tmp PGPORT=54329 PGUSER=postgres POSTGREST_BIN=/var/tmp/pgrst/postgrest tests/e2e/stack.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
STATE=/var/tmp/erp-e2e; mkdir -p "$STATE"; rm -rf /var/tmp/fake-storage
DB=erp_e2e
export JWT_SECRET="e2e-local-secret-$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"

dropdb --force --if-exists "$DB"; createdb "$DB"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/local/supabase_shim.sql >/dev/null
for m in supabase/migrations/*.sql; do psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$m" >/dev/null; done
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/e2e/seed.sql >/dev/null

KEYS=$(node -e '
const c=require("crypto"),s=process.env.JWT_SECRET,b=x=>Buffer.from(x).toString("base64url");
const t=p=>{const h=b(JSON.stringify({alg:"HS256",typ:"JWT"})),q=b(JSON.stringify(p));return h+"."+q+"."+c.createHmac("sha256",s).update(h+"."+q).digest("base64url")};
const e=Math.floor(Date.now()/1000)+86400; console.log(t({role:"anon",exp:e})+" "+t({role:"service_role",exp:e}))')
ANON=${KEYS% *}; SERVICE=${KEYS#* }

cat > "$STATE/pgrst.conf" <<EOF
db-uri = "postgres://authenticator:authenticator@127.0.0.1:${PGPORT}/${DB}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "${JWT_SECRET}"
server-port = 3001
EOF
fuser -k 3001/tcp 54321/tcp 2>/dev/null || true; sleep 1   # PostgREST antigo e gateway fake
nohup "${POSTGREST_BIN:-postgrest}" "$STATE/pgrst.conf" > "$STATE/pgrst.log" 2>&1 &
USERS_JSON="$(cat tests/e2e/users.json)" \
  nohup node tests/e2e/fake-supabase-gateway.mjs > "$STATE/gateway.log" 2>&1 &

export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON"
export SUPABASE_URL=http://localhost:54321 SUPABASE_SERVICE_ROLE_KEY="$SERVICE"
echo "$ANON" > "$STATE/anon.key"
npm run build > "$STATE/build.log" 2>&1
fuser -k 3200/tcp 2>/dev/null || true; sleep 1   # o processo do Next se renomeia para next-server
nohup npx next start -p 3200 > "$STATE/next.log" 2>&1 &
for _ in $(seq 1 60); do curl -sf http://localhost:3200/entrar >/dev/null && break; sleep 1; done
echo "pilha local pronta: app http://localhost:3200 · api http://localhost:54321 · db $DB"
