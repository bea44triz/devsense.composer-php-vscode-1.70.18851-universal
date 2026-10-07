'use client'
// Cadastros por empresa: clientes, centros de custo e fornecedores. O RLS decide quem lê e quem grava.
import { getSupabase } from '@/lib/supabase/client'

export interface Cliente {
  id: string; company_id: string; tipo_pessoa: 'PF' | 'PJ'; razao_social: string; nome_fantasia: string | null
  documento: string | null; telefone: string | null; email: string | null; status: 'ativo' | 'inativo'
}
export interface CentroCusto {
  id: string; company_id: string; codigo: string; nome: string; origem: 'interno' | 'conta_azul' | 'importacao'
  id_externo: string | null; status: 'ativo' | 'inativo'
}
export interface Fornecedor {
  id: string; company_id: string; razao_social: string; nome_fantasia: string | null; documento: string | null
  telefone: string | null; email: string | null; pix_type: string | null; has_pix: boolean; pix_key_masked: string | null
  servico: string | null; status: 'ativo' | 'inativo'
}

export const clienteLabel = (c: Pick<Cliente, 'nome_fantasia' | 'razao_social'>) => c.nome_fantasia || c.razao_social
export const ccLabel = (c: Pick<CentroCusto, 'codigo' | 'nome'>) => `${c.codigo} — ${c.nome}`

export async function fetchClientes(companyIds: string[]): Promise<Cliente[]> {
  if (companyIds.length === 0) return []
  const { data, error } = await getSupabase().from('clientes_evento')
    .select('id, company_id, tipo_pessoa, razao_social, nome_fantasia, documento, telefone, email, status')
    .in('company_id', companyIds).order('razao_social')
  if (error) throw error
  return (data ?? []) as Cliente[]
}

export async function saveCliente(c: Partial<Cliente> & { company_id: string; razao_social: string }) {
  const row = {
    company_id: c.company_id, tipo_pessoa: c.tipo_pessoa ?? 'PJ', razao_social: c.razao_social.trim(),
    nome_fantasia: c.nome_fantasia?.trim() || null, documento: c.documento?.trim() || null,
    telefone: c.telefone?.trim() || null, email: c.email?.trim() || null, status: c.status ?? 'ativo',
  }
  const q = c.id ? getSupabase().from('clientes_evento').update(row).eq('id', c.id) : getSupabase().from('clientes_evento').insert(row)
  const { data, error } = await q.select('id').single()
  if (error) throw error
  return data.id as string
}

export async function fetchCentros(companyIds: string[]): Promise<CentroCusto[]> {
  if (companyIds.length === 0) return []
  const { data, error } = await getSupabase().from('centros_custo')
    .select('id, company_id, codigo, nome, origem, id_externo, status').in('company_id', companyIds).order('codigo')
  if (error) throw error
  return (data ?? []) as CentroCusto[]
}

export async function saveCentro(c: Partial<CentroCusto> & { company_id: string; codigo: string; nome: string }) {
  const row = {
    company_id: c.company_id, codigo: c.codigo.trim(), nome: c.nome.trim(), origem: c.origem ?? 'interno',
    id_externo: c.id_externo?.trim() || null, status: c.status ?? 'ativo',
  }
  const q = c.id ? getSupabase().from('centros_custo').update(row).eq('id', c.id) : getSupabase().from('centros_custo').insert(row)
  const { data, error } = await q.select('id').single()
  if (error) throw error
  return data.id as string
}

export async function fetchFornecedores(companyIds: string[]): Promise<Fornecedor[]> {
  if (companyIds.length === 0) return []
  const { data, error } = await getSupabase().from('fornecedores')
    .select('id, company_id, razao_social, nome_fantasia, documento, telefone, email, pix_type, has_pix, pix_key_masked, servico, status')
    .in('company_id', companyIds).order('razao_social')
  if (error) throw error
  return (data ?? []) as Fornecedor[]
}

/** pix_key só é enviado quando o usuário digitou uma chave nova (a atual nunca chega ao navegador sem permissão). */
export async function saveFornecedor(f: Partial<Fornecedor> & { company_id: string; razao_social: string; pix_key?: string }) {
  const row: Record<string, unknown> = {
    company_id: f.company_id, razao_social: f.razao_social.trim(), nome_fantasia: f.nome_fantasia?.trim() || null,
    documento: f.documento?.trim() || null, telefone: f.telefone?.trim() || null, email: f.email?.trim() || null,
    servico: f.servico?.trim() || null, status: f.status ?? 'ativo',
  }
  if (f.pix_key !== undefined) { row.pix_type = f.pix_key ? f.pix_type : null; row.pix_key = f.pix_key || null }
  const q = f.id ? getSupabase().from('fornecedores').update(row as never).eq('id', f.id) : getSupabase().from('fornecedores').insert(row as never)
  const { data, error } = await q.select('id').single()
  if (error) throw error
  return data.id as string
}

export async function fornecedorPix(id: string) {
  const { data, error } = await getSupabase().rpc('fornecedor_pix', { _fornecedor: id })
  if (error) throw error
  return data?.[0] ?? null
}
