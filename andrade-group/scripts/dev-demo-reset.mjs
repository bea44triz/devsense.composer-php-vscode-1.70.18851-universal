#!/usr/bin/env node
// Zera só os dados da demonstração local (contas, cliente/centro de custo padrão continuam).
// Funciona com o servidor rodando (reseta ao vivo) ou parado (apaga o arquivo local).
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.PORT ?? '3000'
const url = `http://localhost:${PORT}/api/demo/reset`
const dataFile = path.join(process.cwd(), '.demo-data', 'db.json')

try {
  const r = await fetch(url, { method: 'POST' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  console.log('Dados da demonstração zerados (servidor continua no ar). Nenhum evento criado — crie um novo pelo app.')
} catch {
  if (fs.existsSync(dataFile)) {
    fs.rmSync(dataFile)
    console.log('Servidor da demo não estava rodando — arquivo local apagado. Rode "npm run dev:demo" para começar do zero.')
  } else {
    console.log('Nada para zerar (a demo ainda não gerou dados locais).')
  }
}
