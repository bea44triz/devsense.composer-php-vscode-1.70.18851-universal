'use server'
import { auth } from '@/auth'
import { appendEvento, getEventoById } from '@/lib/google-sheets'
import { generateId, makeSlug, normalizeLabel } from '@/lib/utils'
import { EquipeVaga } from '@/types'

export interface CriarEventoPayload {
  titulo: string
  descricao: string
  data: string
  horaInicio: string
  horaFim: string
  local: string
  endereco: string
  latitude: number | null
  longitude: number | null
  equipes: EquipeVaga[]
}

export async function criarEvento(payload: CriarEventoPayload) {
  const session = await auth()
  const managerId = session?.managerId as string | undefined

  if (!managerId) {
    return { success: false as const, error: 'Não autenticado. Faça login novamente.' }
  }

  try {
    const { titulo, descricao, data, horaInicio, horaFim, local, endereco,
            latitude, longitude } = payload

    // Equipes: slug não vazio e único por tipo dentro do evento; label preservado para exibição
    const vistos = new Set<string>()
    const equipes: EquipeVaga[] = []
    for (const e of payload.equipes ?? []) {
      const label = normalizeLabel(e.label ?? e.equipe)
      const slug  = makeSlug(e.equipe)
      if (!label || !slug || slug !== e.equipe) {
        return { success: false as const, error: `Nome de equipe inválido: "${e.label ?? e.equipe}".` }
      }
      const chave = `${slug}|${e.tipo}`
      if (vistos.has(chave)) {
        return { success: false as const, error: `Equipe duplicada: "${label}".` }
      }
      vistos.add(chave)
      equipes.push({ ...e, equipe: slug, label })
    }
    if (equipes.length === 0) {
      return { success: false as const, error: 'Informe ao menos uma equipe com vagas.' }
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
      managerId,
      new Date().toISOString(),
    ]

    console.log('[criarEvento] Salvando evento', id, 'para gerenciador', managerId)
    await appendEvento(row)
    console.log('[criarEvento] appendEvento concluido para', id)

    // Verify the event was actually persisted
    const check = await getEventoById(id)
    if (!check) {
      console.error('[criarEvento] VERIFICAÇÃO FALHOU: evento', id, 'não encontrado após gravar')
      return { success: false as const, error: `Falha ao persistir evento na planilha (ID: ${id}). Verifique os logs do Vercel.` }
    }
    console.log('[criarEvento] Evento verificado com sucesso:', id)
    return { success: true as const, data: { id, titulo } }
  } catch (err) {
    console.error('[criarEvento] Erro:', err)
    const msg = err instanceof Error ? err.message : 'Erro ao criar evento.'
    return { success: false as const, error: msg }
  }
}
