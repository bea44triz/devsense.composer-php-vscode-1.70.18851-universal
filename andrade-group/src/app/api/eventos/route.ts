import { NextRequest, NextResponse } from 'next/server'
import { appendEvento, getEventos, getEventosByGerenciador } from '@/lib/google-sheets'
import { auth } from '@/auth'
import { generateId } from '@/lib/utils'
import { Evento, EquipeVaga } from '@/types'

export function rowToEvento(r: string[]): Evento {
  let equipes: EquipeVaga[] = []
  try { equipes = JSON.parse(r[10] ?? '[]') } catch { equipes = [] }
  return {
    id: r[0], titulo: r[1], descricao: r[2], data: r[3],
    horaInicio: r[4], horaFim: r[5], local: r[6], endereco: r[7],
    latitude:  r[8]  ? Number(r[8])  : undefined,
    longitude: r[9]  ? Number(r[9])  : undefined,
    equipes,
    valorHora: Number(r[11]) || 0,
    status: (r[12] as Evento['status']) || 'aberto',
    gerenciadorId: r[13],
    createdAt: r[14],
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const meus = req.nextUrl.searchParams.get('meus')

  try {
    if (meus && session?.managerId) {
      const rows = await getEventosByGerenciador(session.managerId)
      return NextResponse.json({ success: true, data: rows.map(rowToEvento) })
    }
    const rows = await getEventos()
    return NextResponse.json({ success: true, data: rows.slice(1).map(rowToEvento) })
  } catch (err) {
    console.error('[GET /api/eventos]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar eventos.' }, { status: 500 })
  }
}

// Usando o wrapper auth() para garantir que o session é lido corretamente em Route Handlers
export const POST = auth(async function (req) {
  const managerId = req.auth?.managerId as string | undefined

  if (!managerId) {
    console.error('[POST /api/eventos] Sem managerId. Session:', JSON.stringify(req.auth))
    return NextResponse.json(
      { success: false, error: 'Não autenticado. Faça login novamente.' },
      { status: 401 }
    )
  }

  try {
    const body = await (req as NextRequest).json()
    const { titulo, descricao, data, horaInicio, horaFim, local, endereco,
            latitude, longitude, equipes } = body

    if (!titulo || !data || !horaInicio || !horaFim || !local || !endereco) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios faltando.' }, { status: 400 })
    }
    if (!equipes || !Array.isArray(equipes) || equipes.length === 0) {
      return NextResponse.json({ success: false, error: 'Informe ao menos uma equipe com vagas.' }, { status: 400 })
    }

    const id  = generateId()
    const row = [
      id, titulo, descricao ?? '', data, horaInicio, horaFim,
      local, endereco,
      latitude  != null ? String(latitude)  : '',
      longitude != null ? String(longitude) : '',
      JSON.stringify(equipes),
      '',
      'aberto',
      managerId,
      new Date().toISOString(),
    ]

    console.log('[POST /api/eventos] Salvando evento', id, 'para gerenciador', managerId)
    await appendEvento(row)
    console.log('[POST /api/eventos] Evento salvo com sucesso:', id)

    return NextResponse.json({ success: true, data: { id, titulo } }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/eventos] Erro ao salvar evento:', err)
    const msg = err instanceof Error ? err.message : 'Erro interno ao criar evento.'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
})
