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
    valorHora: Number(r[11]),
    status: r[12] as Evento['status'],
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
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao buscar eventos.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.managerId) {
    return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 })
  }

  try {
    const body = await req.json()
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
      session.managerId,
      new Date().toISOString(),
    ]
    await appendEvento(row)

    return NextResponse.json({ success: true, data: { id, titulo } }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro interno ao criar evento.' }, { status: 500 })
  }
}
