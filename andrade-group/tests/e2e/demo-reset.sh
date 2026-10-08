#!/usr/bin/env bash
# Reseta SOMENTE o banco local descartável da demo (mantém PostgREST/gateway/Next no ar): npm run demo:reset
# Trava (ver demo-env.sh) contra qualquer coisa que não seja o Postgres local descartável.
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=./demo-env.sh
source tests/e2e/demo-env.sh

tests/e2e/reset-db.sh

cat <<'EOF'

Banco da demo recriado do zero: migrations + cliente/centro de custo/usuários da demonstração prontos.
Nenhum evento foi criado — crie-o ao vivo seguindo docs/DEMO.md.
EOF
