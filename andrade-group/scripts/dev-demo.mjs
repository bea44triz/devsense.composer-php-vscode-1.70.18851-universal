#!/usr/bin/env node
// Sobe o ERP em modo demonstração: sem Supabase remoto, sem PostgreSQL, sem Docker, sem WSL.
// Funciona igual no Windows, macOS e Linux porque usa só Node.js (nada de bash/.sh).
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const nextBin = require.resolve('next/dist/bin/next')
const PORT = process.env.PORT ?? '3000'

console.log(`
════════════════════════════════════════════════════════════════
  MODO DEMONSTRAÇÃO — sem Supabase, sem PostgreSQL, sem Docker

  Abrindo em: http://localhost:${PORT}

  Login (coordenador): demo@061.test            / senha-teste
  Login (financeiro):  financeiro.demo@061.test / senha-teste

  Os dados ficam só neste computador, em .demo-data/db.json, e
  podem ser zerados a qualquer momento com: npm run dev:demo:reset

  Roteiro de demonstração: docs/DEMO_LOCAL.md
════════════════════════════════════════════════════════════════
`)

const child = spawn(process.execPath, [nextBin, 'dev', '--port', PORT], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ERP_DEMO_MODE: 'true',
    NEXT_PUBLIC_ERP_DEMO_MODE: 'true',
    // Garante que nenhuma chave real do .env.local seja usada mesmo que esteja presente.
    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
  },
})

child.on('exit', (code) => process.exit(code ?? 0))
