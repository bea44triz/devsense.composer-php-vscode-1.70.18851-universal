import { NextRequest, NextResponse } from 'next/server'
import { appendCheckInOut, getCheckInOutByEvento, getInscricaoByCpfEvento, getEventoById } from '@/lib/google-sheets'
import { generateId } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const { tipoRegistro, cpf, eventoId, latitude, longitude, accuracy } = await req.json()

    if (!tipoRegistro || !cpf || !eventoId || latitude == null || longitude == null) {
      return NextResponse.json(
        { success: false, error: 'tipoRegistro, cpf, eventoId, latitude e longitude são obrigatórios.' },
        { status: 400 }
      )
    }

    if (!['checkin', 'checkout'].includes(tipoRegistro)) {
      return NextResponse.json({ success: false, error: 'tipoRegistro deve ser "checkin" ou "checkout".' }, { status: 400 })
    }

    const eventoRow = await getEventoById(eventoId)
    if (!eventoRow) {
      return NextResponse.json({ success: false, error: 'Evento não encontrado.' }, { status: 404 })
    }

    const inscricao = await getInscricaoByCpfEvento(cpf, eventoId)
    const nome   = inscricao ? inscricao[2] : ''
    const equipe = inscricao ? inscricao[8] : ''
    const tipo   = inscricao ? inscricao[9] : ''

    const id        = generateId()
    const timestamp = new Date().toISOString()
    const row = [
      id, eventoId, cpf, nome, equipe, tipo, tipoRegistro,
      String(latitude), String(longitude), String(accuracy ?? ''), timestamp,
    ]
    await appendCheckInOut(row)

    return NextResponse.json({ success: true, data: { id, tipoRegistro, timestamp, nome } }, { status: 201 })
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
    const rows = await getCheckInOutByEvento(eventoId)
    const registros = rows.map(r => ({
      id: r[0], eventoId: r[1], cpf: r[2], nome: r[3],
      equipe: r[4], tipo: r[5], tipoRegistro: r[6],
      latitude: Number(r[7]), longitude: Number(r[8]),
      accuracy: Number(r[9]), timestamp: r[10],
    }))
    return NextResponse.json({ success: true, data: registros })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao buscar registros.' }, { status: 500 })
  }
}
