import { NextRequest, NextResponse } from 'next/server'
import { getEventoById, getInscricoesByEvento, contarPreenchidas } from '@/lib/google-sheets'
import { vagasDisponiveis } from '@/lib/utils'
import { EquipeVaga } from '@/types'

// Deprecated POST — kept to return a clear error instead of 404
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Use /api/inscricoes para registrar.' },
    { status: 410 }
  )
}

/**
 * GET /api/vagas?eventoId=...&equipe=...&tipo=...
 * Returns vacancy counts for a specific equipe+tipo without exposing personal data.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const eventoId = searchParams.get('eventoId')
  const equipe   = searchParams.get('equipe')
  const tipo     = searchParams.get('tipo')

  if (!eventoId || !equipe || !tipo) {
    return NextResponse.json(
      { success: false, error: 'eventoId, equipe e tipo são obrigatórios.' },
      { status: 400 }
    )
  }

  try {
    const eventoRow = await getEventoById(eventoId)
    if (!eventoRow) {
      return NextResponse.json({ success: false, error: 'Evento não encontrado.' }, { status: 404 })
    }

    let equipes: EquipeVaga[] = []
    try { equipes = JSON.parse(eventoRow[10] ?? '[]') } catch { equipes = [] }

    const vagaAlvo = equipes.find(e => e.equipe === equipe && e.tipo === tipo)
    if (!vagaAlvo) {
      return NextResponse.json({ success: false, error: 'Vaga não encontrada.' }, { status: 404 })
    }

    const total      = vagaAlvo.vagas
    const inscricoes = await getInscricoesByEvento(eventoId)
    const preenchidas = contarPreenchidas(inscricoes, equipe, tipo)
    const disponivel  = vagasDisponiveis(total, preenchidas)  // Math.max(0, total - preenchidas)
    // preenchidas > total indicates a data inconsistency (race or manual edit)
    const inconsistente = preenchidas > total

    return NextResponse.json({ success: true, data: { total, preenchidas, disponivel, inconsistente } })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao verificar vagas.' }, { status: 500 })
  }
}
