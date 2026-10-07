#!/usr/bin/env bash
# Derruba a pilha local do E2E (Next na porta 3200, PostgREST e gateway fake).
for pat in "next start -p 3200" "erp-e2e/pgrst.conf" "tests/e2e/fake-supabase-gateway"; do
  for p in $(pgrep -f "$pat"); do [ "$p" != "$$" ] && kill "$p" 2>/dev/null; done
done
echo "pilha local parada"
