'use client'
// Usuários e Permissões por empresa. Toda regra (quem pode gerenciar, quem some da busca, Super Admin à parte)
// é decidida no banco (RLS + RPCs SECURITY DEFINER); aqui só chamamos e tipamos.
import { getSupabase } from '@/lib/supabase/client'
import type { Permission } from '@/lib/erp/environment-rules'

export interface CompanyUserRow {
  user_id: string; email: string; full_name: string | null; active: boolean
  permissions: Permission[]; operations_count: number; is_platform_admin: boolean
}

export interface UserOperationRow {
  operation_id: string; type: 'EVENTO' | 'PONTO_FIXO'; code: string; name: string
  role: 'responsavel' | 'coordenador' | 'lider'; status: string
}

export async function fetchCompanyUsers(companyId: string): Promise<CompanyUserRow[]> {
  const { data, error } = await getSupabase().rpc('users_admin_list', { _company_id: companyId })
  if (error) throw error
  return (data ?? []) as CompanyUserRow[]
}

export async function lookupUserByEmail(companyId: string, email: string) {
  const { data, error } = await getSupabase().rpc('user_lookup_by_email', { _company_id: companyId, _email: email })
  if (error) throw error
  return (data ?? []) as { user_id: string; email: string; full_name: string | null; already_linked: boolean }[]
}

export async function setCompanyUserAccess(companyId: string, userId: string, active: boolean, permissions: Permission[]) {
  const { error } = await getSupabase().rpc('company_user_set_access', { _company_id: companyId, _user_id: userId, _active: active, _permissions: permissions })
  if (error) throw error
}

export async function revokeCompanyUser(companyId: string, userId: string) {
  const { error } = await getSupabase().rpc('company_user_revoke', { _company_id: companyId, _user_id: userId })
  if (error) throw error
}

export async function fetchUserOperations(companyId: string, userId: string): Promise<UserOperationRow[]> {
  const { data, error } = await getSupabase().rpc('user_operations_list', { _company_id: companyId, _user_id: userId })
  if (error) throw error
  return (data ?? []) as UserOperationRow[]
}

/** Papéis pré-definidos: atalhos que marcam um conjunto de permissões (o acesso de verdade continua sendo as permissões). */
export const ROLE_PRESETS: { key: string; label: string; perms: Permission[] }[] = [
  { key: 'admin', label: 'Administrador da empresa', perms: ['empresa.admin'] },
  { key: 'gestor', label: 'Gestor operacional (todas as operações)', perms: ['operacao.gerenciar', 'operacao.todos'] },
  { key: 'coordenador', label: 'Coordenador / Líder (só operações atribuídas)', perms: ['operacao.gerenciar'] },
  { key: 'financeiro', label: 'Financeiro', perms: ['financeiro.gerenciar'] },
  { key: 'consulta', label: 'Consulta (operação)', perms: ['operacao.ver'] },
  { key: 'custom', label: 'Personalizado', perms: [] },
]

export function roleLabelFor(perms: Permission[]): string {
  if (perms.includes('empresa.admin')) return 'Administrador da empresa'
  if (perms.includes('operacao.gerenciar') && perms.includes('operacao.todos')) return 'Gestor operacional'
  if (perms.includes('operacao.gerenciar')) return 'Coordenador / Líder'
  if (perms.includes('financeiro.gerenciar')) return 'Financeiro'
  if (perms.includes('operacao.ver') || perms.includes('financeiro.ver')) return 'Consulta'
  return perms.length ? 'Personalizado' : 'Sem permissões';
}
