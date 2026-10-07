'use client'
// Pontos Fixos: posto, alocação de profissionais e competência mensal. Regras críticas ficam nas RPCs do banco.
import { getSupabase } from '@/lib/supabase/client'

export interface FixedMember {
  id: string; person_id: string; role: string | null; start_date: string; end_date: string | null; monthly_rate: number; status: 'ativo' | 'inativo'
  people: { full_name: string; cpf: string; phone: string | null; has_pix: boolean } | null
}
export interface PeriodItem {
  id: string; period_id: string; member_id: string; person_id: string; base_amount: number; absences: number
  discount: number; addition: number; final_amount: number; notes: string | null; status: 'pendente' | 'conferido'
  people: { full_name: string; cpf: string; has_pix: boolean; pix_updated_publicly_at: string | null } | null
}
export interface Period {
  id: string; competence: string; status: 'aberta' | 'validada' | 'enviada'; validated_at: string | null; sent_at: string | null
  fixed_post_period_items: PeriodItem[]
}
export interface FixedPost {
  id: string; company_id: string; code: string; name: string; client_name: string | null; cost_center: string | null
  cliente_evento_id: string | null; centro_custo_id: string | null; category: string | null; subcategory: string | null
  location: string | null; address: string | null; manager_name: string | null; planned_headcount: number
  start_date: string | null; notes: string | null; status: 'ativo' | 'suspenso' | 'encerrado'; created_at: string
  fixed_post_members: FixedMember[]
  fixed_post_periods: Period[]
}

const POST_SELECT = '*, fixed_post_members(id, person_id, role, start_date, end_date, monthly_rate, status, people(full_name, cpf, phone, has_pix)), '
  + 'fixed_post_periods(id, competence, status, validated_at, sent_at, fixed_post_period_items(id, period_id, member_id, person_id, base_amount, absences, discount, addition, final_amount, notes, status, people(full_name, cpf, has_pix, pix_updated_publicly_at)))'

export const SUBCATEGORIES: Record<string, string[]> = {
  'Segurança': ['Segurança de Obras', 'Segurança Patrimonial', 'Portaria', 'Vigilância Noturna'],
  'Limpeza': ['Limpeza Predial', 'Limpeza Pós-Obra', 'Jardinagem'],
  'Recepção': ['Recepção Corporativa', 'Recepção Hospitalar'],
  'Apoio': ['Apoio Operacional', 'Manutenção'],
  'Brigada': ['Brigada de Incêndio'],
}

export async function fetchFixedPosts(companyIds: string[]): Promise<FixedPost[]> {
  if (companyIds.length === 0) return []
  const { data, error } = await getSupabase().from('fixed_posts').select(POST_SELECT).in('company_id', companyIds).order('name')
  if (error) throw error
  return (data ?? []) as unknown as FixedPost[]
}

export async function fetchFixedPost(id: string): Promise<FixedPost | null> {
  const { data, error } = await getSupabase().from('fixed_posts').select(POST_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as FixedPost | null
}

export async function createFixedPost(companyId: string, data: Record<string, unknown>): Promise<string> {
  const { data: id, error } = await getSupabase().rpc('fixed_post_create', { _company_id: companyId, _data: data as never })
  if (error) throw error
  return id as string
}

export async function addMember(companyId: string, postId: string, personId: string, role: string, start: string, monthly: number) {
  const { error } = await getSupabase().from('fixed_post_members').insert({
    company_id: companyId, fixed_post_id: postId, person_id: personId, role: role || null, start_date: start, monthly_rate: monthly,
  })
  if (error) throw error
}

export async function updateMember(id: string, patch: { monthly_rate?: number; role?: string | null; status?: 'ativo' | 'inativo'; end_date?: string | null }) {
  const { error } = await getSupabase().from('fixed_post_members').update(patch).eq('id', id)
  if (error) throw error
}

export async function openPeriod(postId: string, competence: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('fixed_post_open_period', { _fixed_post_id: postId, _competence: competence })
  if (error) throw error
  return data as string
}

export async function updateItem(id: string, patch: { absences?: number; discount?: number; addition?: number; notes?: string | null; status?: 'pendente' | 'conferido' }) {
  const { error } = await getSupabase().from('fixed_post_period_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function validatePeriod(periodId: string) {
  const { error } = await getSupabase().rpc('fixed_post_validate_period', { _period_id: periodId })
  if (error) throw error
}
export async function reopenPeriod(periodId: string) {
  const { error } = await getSupabase().rpc('fixed_post_reopen_period', { _period_id: periodId })
  if (error) throw error
}
export async function sendPeriod(periodId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('fixed_post_send_period', { _period_id: periodId })
  if (error) throw error
  return data ?? 0
}

/** Primeiro dia do mês atual (YYYY-MM-01) no fuso local. */
export function currentCompetence(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export function monthlyTotal(p: Pick<FixedPost, 'fixed_post_members'>): number {
  return p.fixed_post_members.filter((m) => m.status === 'ativo').reduce((a, m) => a + Number(m.monthly_rate), 0)
}

/** Sugestão de desconto por faltas: valor base ÷ 30 × faltas (o líder pode ajustar). */
export function absenceDiscount(base: number, absences: number): number {
  return Math.round((Number(base) / 30) * absences * 100) / 100
}
