'use client'
// Base central de profissionais (por empresa). PIX completo só via person_pix (permissão financeira).
import { getSupabase } from '@/lib/supabase/client'

export interface Person {
  id: string; company_id: string; full_name: string; cpf: string; phone: string | null; email: string | null
  pix_type: string | null; has_pix: boolean; pix_key_masked: string | null; main_role: string | null; status: string
  pix_updated_publicly_at: string | null; created_at: string
}
const PERSON_COLS = 'id, company_id, full_name, cpf, phone, email, pix_type, has_pix, pix_key_masked, main_role, status, pix_updated_publicly_at, created_at'

export interface PersonListRow extends Person {
  event_participants: { status: string; event_teams: { name: string } | null }[]
  fixed_post_members: { status: string; fixed_posts: { name: string } | null }[]
}

export async function fetchPeople(companyIds: string[]): Promise<PersonListRow[]> {
  if (companyIds.length === 0) return []
  const { data, error } = await getSupabase().from('people')
    .select(`${PERSON_COLS}, event_participants(status, event_teams(name)), fixed_post_members(status, fixed_posts(name))`)
    .in('company_id', companyIds).order('full_name')
  if (error) throw error
  return (data ?? []) as unknown as PersonListRow[]
}

export async function searchPeople(companyId: string, term: string): Promise<Person[]> {
  const t = term.trim()
  if (t.length < 2) return []
  const digits = t.replace(/\D/g, '')
  let q = getSupabase().from('people').select(PERSON_COLS).eq('company_id', companyId).limit(8)
  q = digits.length >= 3 ? q.like('cpf', `${digits}%`) : q.ilike('full_name', `%${t}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Person[]
}

export interface PersonProfile extends Person {
  event_participants: {
    id: string; status: string; worked: boolean | null; days: number; final_amount: number
    event_teams: { name: string } | null
    events: { id: string; code: string; name: string; event_date: string; end_date: string | null } | null
    attendance: { kind: string; work_date: string; recorded_at: string; inside_radius: boolean | null }[]
  }[]
  fixed_post_members: {
    id: string; role: string | null; start_date: string; end_date: string | null; monthly_rate: number; status: string
    fixed_posts: { id: string; code: string; name: string; category: string | null; subcategory: string | null } | null
  }[]
}

export async function fetchPerson(id: string): Promise<PersonProfile | null> {
  const { data, error } = await getSupabase().from('people').select(`${PERSON_COLS},
    event_participants(id, status, worked, days, final_amount, event_teams(name), events(id, code, name, event_date, end_date), attendance(kind, work_date, recorded_at, inside_radius)),
    fixed_post_members(id, role, start_date, end_date, monthly_rate, status, fixed_posts(id, code, name, category, subcategory))`).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as PersonProfile | null
}

export async function personPix(id: string) {
  const { data, error } = await getSupabase().rpc('person_pix', { _person: id })
  if (error) throw error
  return data?.[0] ?? null
}

export async function personPayables(id: string) {
  const { data, error } = await getSupabase().from('payables')
    .select('id, company_id, status, origin, amount, description, payee_name, payee_document, pix_type, pix_key, op_code, op_name, ref_date, competence, cost_center, due_date, created_at')
    .eq('person_id', id).order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertPerson(companyId: string, data: { cpf: string; full_name: string; phone?: string; email?: string; pix_type?: string; pix_key?: string; main_role?: string }): Promise<string> {
  const { data: id, error } = await getSupabase().rpc('person_upsert', { _company_id: companyId, _data: data })
  if (error) throw error
  return id as string
}
