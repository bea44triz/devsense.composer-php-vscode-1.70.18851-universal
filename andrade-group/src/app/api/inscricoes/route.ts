import { NextRequest, NextResponse } from 'next/server'
import { appendInscricao, getInscricoesByEvento, getEventoById, contarPreenchidas } from '@/lib/google-sheets'
import {
  generateId, onlyDigits,
  isValidCpf, isValidEmail, isValidPhone, isValidPixKey, hasFullName,
  normalizePixKey, isPixTipo, vagasDisponiveis,
} from '@/lib/utils'
import { EquipeVaga } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { eventoId, nome, cpf, telefone, email, pixTipo, pixChave, equipe, tipo } = await req.json()

    // ── Presence check ─────────────────────────────────────────────────────────
    if (!eventoId || !nome || !cpf || !telefone || !email || !pixTipo || !pixChave || !equipe || !tipo) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios faltando.' }, { status: 400 })
    }

    // ── pixTipo enum check ──────────────────────────────────────────────────────
    if (!isPixTipo(pixTipo)) {
      return NextResponse.json(
        { success: false, error: `Tipo de chave PIX inválido: ${pixTipo}.` },
        { status: 422 }
      )
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

    if (!isValidPixKey(pixChave, pixTipo)) {
      return NextResponse.json({ success: false, error: 'Chave PIX inválida para o tipo selecionado.' }, { status: 422 })
    }

    // ── Event existence ─────────────────────────────────────────────────────────
    const eventoRow = await getEventoById(eventoId)
    if (!eventoRow) {
      return NextResponse.json({ success: false, error: 'Evento não encontrado.' }, { status: 404 })
    }

    // ── Vacancy check ───────────────────────────────────────────────────────────
    // LIMITAÇÃO: leitura seguida de escrita no Google Sheets, NÃO atômica. Duas requisições
    // simultâneas podem ler "1 vaga" e ambas gravar (preenchidas > vagas). A última vaga
    // não está protegida contra concorrência. Ver MAPA_DO_PROJETO.md §9.
    let equipes: EquipeVaga[] = []
    try { equipes = JSON.parse(eventoRow[10] ?? '[]') } catch { equipes = [] }

    const vagaAlvo = equipes.find(e => e.equipe === equipe && e.tipo === tipo)
    if (!vagaAlvo || vagaAlvo.vagas <= 0) {
      return NextResponse.json({ success: false, error: 'Esta vaga não está mais disponível.' }, { status: 409 })
    }

    const inscritas   = await getInscricoesByEvento(eventoId)
    const preenchidas = contarPreenchidas(inscritas, equipe, tipo)
    if (vagasDisponiveis(vagaAlvo.vagas, preenchidas) === 0) {
      return NextResponse.json({ success: false, error: 'Esta vaga não está mais disponível.' }, { status: 409 })
    }

    // ── Persist ─────────────────────────────────────────────────────────────────
    const id          = generateId()
    const pixChaveNorm = normalizePixKey(pixChave, pixTipo)
    // Todos os campos como string limpa — sem Number()/parseInt e sem prefixo.
    const row = [
      id, eventoId, String(nome).trim(), cpfNorm, onlyDigits(telefone), String(email).trim(),
      pixTipo, pixChaveNorm, equipe, tipo,
      new Date().toISOString(),
      'ativa',
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
      equipe: r[8], tipo: r[9], criadoEm: r[10], status: r[11] || 'ativa',
    }))
    return NextResponse.json({ success: true, data: inscricoes })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao buscar inscrições.' }, { status: 500 })
  }
}
