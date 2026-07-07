import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sheetGet } from '@/lib/google-sheets'

// Endpoint temporário de diagnóstico — pode ser removido após resolver os problemas
export const GET = auth(async function (req) {
  const sessionInfo = {
    authenticated: !!req.auth,
    managerId: (req.auth as { managerId?: string })?.managerId ?? null,
    email: req.auth?.user?.email ?? null,
  }

  const sheetsInfo: Record<string, unknown> = {
    GOOGLE_SHEETS_ID: process.env.GOOGLE_SHEETS_ID ? '✓ definido' : '✗ NÃO DEFINIDO',
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      ? (process.env.GOOGLE_SERVICE_ACCOUNT_JSON === '{}'
          ? '✗ é {} (placeholder vazio)'
          : '✓ definido')
      : '✗ NÃO DEFINIDO',
  }

  // Tenta ler cada aba
  for (const sheet of ['Gerenciadores', 'Eventos', 'Inscricoes', 'CheckInOut']) {
    try {
      const rows = await sheetGet(`${sheet}!A1:A5`)
      sheetsInfo[sheet] = `✓ acessível (${rows.length} linhas lidas)`
    } catch (err) {
      sheetsInfo[sheet] = `✗ ERRO: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  return NextResponse.json({ session: sessionInfo, sheets: sheetsInfo })
})
