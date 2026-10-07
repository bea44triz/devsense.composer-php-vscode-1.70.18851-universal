#!/usr/bin/env bash
# Derruba a pilha local do E2E (Next na porta 3200, PostgREST e gateway fake).
for pat in "next start -p 3200" "erp-e2e/pgrst.conf" "tests/e2e/fake-supabase-gateway"; do
  for p in $(pgrep -f "$pat"); do [ "$p" != "$$" ] && kill "$p" 2>/dev/null; done
done
fuser -k 3200/tcp 3001/tcp 54321/tcp 2>/dev/null   # o Next se renomeia para next-server
echo "pilha local parada"
