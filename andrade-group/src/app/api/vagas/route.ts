import { NextRequest, NextResponse } from 'next/server'
import {
  getEventoById, updateVagasOcupadas,
  appendInscricao, getInscricoesByEvento
} from '@/lib/google-sheets'
import { generateId } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const { eventoId, freelancerId } = await req.json()
    if (!eventoId || !freelancerId) {
      return NextResponse.json({ success: false, error: 'eventoId e freelancerId são obrigatórios.' }, { status: 400 })
    }

    const eventoRow = await getEventoById(eventoId)
    if (!eventoRow) return NextResponse.json({ success: false, error: 'Evento não encontrado.' }, { status: 404 })
    if (eventoRow[11] !== 'aberto') {
      return NextResponse.json({ success: false, error: 'Evento não está aberto para inscrições.' }, { status: 409 })
    }

    // Verifica se o freelancer já está inscrito
    const inscricoes = await getInscricoesByEvento(eventoId)
    const jaInscrito = inscricoes.find((i) => i[2] === freelancerId && i[4] !== 'cancelado')
    if (jaInscrito) {
      return NextResponse.json({ success: false, error: 'Freelancer já inscrito neste evento.' }, { status: 409 })
    }

    const vagasTotal = Number(eventoRow[8])
    const vagasOcupadas = Number(eventoRow[9])
    const temVaga = vagasOcupadas < vagasTotal

    let status: 'confirmado' | 'lista_espera' = temVaga ? 'confirmado' : 'lista_espera'
    let posicaoListaEspera: number | undefined

    if (!temVaga) {
      posicaoListaEspera = inscricoes.filter((i) => i[4] === 'lista_espera').length + 1
    } else {
      await updateVagasOcupadas(eventoId, vagasOcupadas + 1)
    }

    const id = generateId()
    const row = [id, eventoId, freelancerId, '', status,
                 posicaoListaEspera ? String(posicaoListaEspera) : '', '', new Date().toISOString()]
    await appendInscricao(row)

    return NextResponse.json({
      success: true,
      data: { id, eventoId, freelancerId, status, posicaoListaEspera },
    }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro interno ao inscrever.' }, { status: 500 })
  }
}
