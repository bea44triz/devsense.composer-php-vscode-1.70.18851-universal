import { NextRequest, NextResponse } from 'next/server'
import { appendInscricao, getInscricoesByEvento, getEventoById } from '@/lib/google-sheets'
import { generateId, onlyDigits, isValidCpf, isValidEmail, isValidPhone, isValidPixKey, hasFullName } from '@/lib/utils'
import { EquipeVaga } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { eventoId, nome, cpf, telefone, email, pixTipo, pixChave, equipe, tipo } = await req.json()

    // ── Presence check ─────────────────────────────────────────────────────────
    if (!eventoId || !nome || !cpf || !telefone || !email || !pixChave || !equipe || !tipo) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios faltando.' }, { status: 400 })
    }

    // ── Format / value validation ───────────────────────────────────────────────
    if (!hasFullName(nome)) {
      return NextResponse.json({ success: false, error: 'Informe nome e sobrenome.' }, { status: 422 })
    }

    const cpfNorm = onlyDigits(cpf)
    if (!isValidCpf(cpfNorm)) {
      return NextResponse.json({ success: false, error: 'CPF inválido.' }, { status: 422 })
    }

    if (!isValidPhone(telefone)) {
      return NextResponse.json({ success: false, error: 'Telefone inválido. Informe DDD + número.' }, { status: 422 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ success: false, error: 'E-mail inválido.' }, { status: 422 })
    }

    if (!isValidPixKey(pixChave, pixTipo ?? 'cpf')) {
      return NextResponse.json({ success: false, error: 'Chave PIX inválida para o tipo selecionado.' }, { status: 422 })
    }

    // ── Event existence ─────────────────────────────────────────────────────────
    const eventoRow = await getEventoById(eventoId)
    if (!eventoRow) {
      return NextResponse.json({ success: false, error: 'Evento não encontrado.' }, { status: 404 })
    }

    // ── Vacancy check ───────────────────────────────────────────────────────────
    let equipes: EquipeVaga[] = []
    try { equipes = JSON.parse(eventoRow[10] ?? '[]') } catch { equipes = [] }

    const vagaAlvo = equipes.find(e => e.equipe === equipe && e.tipo === tipo)
    if (!vagaAlvo || vagaAlvo.vagas <= 0) {
      return NextResponse.json({ success: false, error: 'Esta vaga não está mais disponível.' }, { status: 409 })
    }

    const inscritas = await getInscricoesByEvento(eventoId)
    const preenchidas = inscritas.filter(r => r[8] === equipe && r[9] === tipo).length
    if (preenchidas >= vagaAlvo.vagas) {
      return NextResponse.json({ success: false, error: 'Esta vaga não está mais disponível.' }, { status: 409 })
    }

    // ── Persist ─────────────────────────────────────────────────────────────────
    const id  = generateId()
    const row = [
      id, eventoId, nome, cpfNorm, onlyDigits(telefone), email,
      pixTipo ?? 'cpf', pixChave.trim(), equipe, tipo,
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
