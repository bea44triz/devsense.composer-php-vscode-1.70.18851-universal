import { NextRequest, NextResponse } from 'next/server'
import { getEventoById } from '@/lib/google-sheets'
import { Evento } from '@/types'

function rowToEvento(r: string[]): Evento {
  return {
    id: r[0], titulo: r[1], descricao: r[2], data: r[3],
    horaInicio: r[4], horaFim: r[5], local: r[6],
    endereco: r[7], vagasTotal: Number(r[8]), vagasOcupadas: Number(r[9]),
    valorHora: Number(r[10]), status: r[11] as Evento['status'],
    createdAt: r[12],
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const row = await getEventoById(id)
    if (!row) return NextResponse.json({ success: false, error: 'Evento não encontrado.' }, { status: 404 })
    return NextResponse.json({ success: true, data: rowToEvento(row) })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao buscar evento.' }, { status: 500 })
  }
}
