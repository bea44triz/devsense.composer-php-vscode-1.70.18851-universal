import { NextRequest, NextResponse } from 'next/server'
import { appendEvento, getEventos } from '@/lib/google-sheets'
import { generateId } from '@/lib/utils'
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

export async function GET() {
  try {
    const rows = await getEventos()
    const eventos = rows.slice(1).map(rowToEvento)
    return NextResponse.json({ success: true, data: eventos })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao buscar eventos.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { titulo, descricao, data, horaInicio, horaFim, local, endereco, vagasTotal, valorHora } = body

    if (!titulo || !data || !horaInicio || !horaFim || !local || !endereco || !vagasTotal || !valorHora) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios faltando.' }, { status: 400 })
    }

    const id = generateId()
    const row = [id, titulo, descricao ?? '', data, horaInicio, horaFim, local, endereco,
                 String(vagasTotal), '0', String(valorHora), 'aberto', new Date().toISOString()]
    await appendEvento(row)

    return NextResponse.json({ success: true, data: { id, titulo } }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro interno ao criar evento.' }, { status: 500 })
  }
}
