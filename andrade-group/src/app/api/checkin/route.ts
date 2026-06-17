import { NextRequest, NextResponse } from 'next/server'
import { appendCheckInOut, getEventoById } from '@/lib/google-sheets'
import { generateId } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const { tipo, freelancerId, eventoId, latitude, longitude, accuracy, foto } = await req.json()

    if (!tipo || !freelancerId || !eventoId || latitude == null || longitude == null) {
      return NextResponse.json(
        { success: false, error: 'tipo, freelancerId, eventoId, latitude e longitude são obrigatórios.' },
        { status: 400 }
      )
    }

    if (!['checkin', 'checkout'].includes(tipo)) {
      return NextResponse.json({ success: false, error: 'tipo deve ser "checkin" ou "checkout".' }, { status: 400 })
    }

    const eventoRow = await getEventoById(eventoId)
    if (!eventoRow) {
      return NextResponse.json({ success: false, error: 'Evento não encontrado.' }, { status: 404 })
    }

    // Em produção: enviar foto (base64) ao Google Drive/S3 e salvar URL
    const fotoUrl = foto ? `data:image/jpeg;base64,pendente` : ''

    const id = generateId()
    const timestamp = new Date().toISOString()
    const row = [id, eventoId, freelancerId, '', tipo,
                 String(latitude), String(longitude), String(accuracy ?? ''), fotoUrl, timestamp]
    await appendCheckInOut(row)

    return NextResponse.json({ success: true, data: { id, tipo, timestamp } }, { status: 201 })
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
    const { getCheckInOutByEvento } = await import('@/lib/google-sheets')
    const rows = await getCheckInOutByEvento(eventoId)
    const registros = rows.map((r) => ({
      id: r[0], eventoId: r[1], freelancerId: r[2], freelancerNome: r[3],
      tipo: r[4], latitude: Number(r[5]), longitude: Number(r[6]),
      accuracy: Number(r[7]), fotoUrl: r[8], timestamp: r[9],
    }))
    return NextResponse.json({ success: true, data: registros })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao buscar registros.' }, { status: 500 })
  }
}
