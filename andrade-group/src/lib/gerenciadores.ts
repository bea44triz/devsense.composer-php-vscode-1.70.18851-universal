import { getGerenciadorByEmail, appendGerenciador } from '@/lib/google-sheets'
import { generateId } from '@/lib/utils'

export interface Gerenciador {
  id:        string
  nome:      string
  email:     string
  status:    'ativo' | 'pendente' | 'suspenso'
  criadoEm:  string
}

function rowToGerenciador(r: string[]): Gerenciador {
  return {
    id:       r[0],
    nome:     r[1],
    email:    r[2],
    status:   (r[3] as Gerenciador['status']) ?? 'ativo',
    criadoEm: r[4],
  }
}

/**
 * Called on every Google OAuth sign-in.
 * If the manager is new, creates their record in the Gerenciadores sheet automatically.
 * Returns the existing or newly created record.
 */
export async function getOrCreateGerenciador({
  email,
  nome,
}: {
  email: string
  nome:  string
}): Promise<Gerenciador> {
  const existing = await getGerenciadorByEmail(email)
  if (existing) return rowToGerenciador(existing)

  const gerenciador: Gerenciador = {
    id:       generateId(),
    nome,
    email,
    status:   'ativo',    // auto-aprovado — mude para 'pendente' se quiser aprovação manual
    criadoEm: new Date().toISOString(),
  }

  await appendGerenciador([
    gerenciador.id,
    gerenciador.nome,
    gerenciador.email,
    gerenciador.status,
    gerenciador.criadoEm,
  ])

  return gerenciador
}
