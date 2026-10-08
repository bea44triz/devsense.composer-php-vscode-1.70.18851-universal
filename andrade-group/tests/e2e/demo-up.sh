#!/usr/bin/env bash
# Sobe a pilha local de demonstração com um comando só: npm run demo
# Trava (ver demo-env.sh) contra qualquer coisa que não seja o Postgres local descartável.
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=./demo-env.sh
source tests/e2e/demo-env.sh

echo "Portas ocupadas (3200 app · 3001 PostgREST · 54321 API) serão liberadas automaticamente, se preciso."
tests/e2e/stack.sh

cat <<'EOF'

════════════════════════════════════════════════════════════════
  DEMO PRONTA
  App:  http://localhost:3200
  API:  http://localhost:54321 (PostgREST local, não é Supabase remoto)

  Login da demo:    demo@061.test            / senha-teste
  Login financeiro: financeiro.demo@061.test / senha-teste

  Roteiro completo: docs/DEMO.md
  Para recomeçar do zero sem derrubar a pilha: npm run demo:reset
════════════════════════════════════════════════════════════════
EOF
