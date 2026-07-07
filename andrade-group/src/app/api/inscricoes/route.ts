import { NextRequest, NextResponse } from 'next/server'
import { appendInscricao, getInscricoesByEvento, getEventoById } from '@/lib/google-sheets'
import { generateId } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const { eventoId, nome, cpf, telefone, email, pixTipo, pixChave, equipe, tipo } = await req.json()

    if (!eventoId || !nome || !cpf || !telefone || !email || !pixChave || !equipe || !tipo) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios faltando.' }, { status: 400 })
    }

    const eventoRow = await getEventoById(eventoId)
    if (!eventoRow) {
      return NextResponse.json({ success: false, error: 'Evento não encontrado.' }, { status: 404 })
    }

    const id  = generateId()
    const row = [
      id, eventoId, nome, cpf, telefone, email,
      pixTipo ?? 'cpf', pixChave, equipe, tipo,
      new Date().toISOString(),
    ]
    await appendInscricao(row)

    return NextResponse.json({ success: true, data: { id, nome } }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro interno ao registrar.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const eventoId = req.nextUrl.searchParams.get('eventoId')
  if (!eventoId) {
    return NextResponse.json({ success: false, error: 'eventoId obrigatório.' }, { status: 400 })
  }
  try {
    const rows = await getInscricoesByEvento(eventoId)
    const inscricoes = rows.map(r => ({
      id: r[0], eventoId: r[1], nome: r[2], cpf: r[3],
      telefone: r[4], email: r[5], pixTipo: r[6], pixChave: r[7],
      equipe: r[8], tipo: r[9], criadoEm: r[10],
    }))
    return NextResponse.json({ success: true, data: inscricoes })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao buscar inscrições.' }, { status: 500 })
  }
}
