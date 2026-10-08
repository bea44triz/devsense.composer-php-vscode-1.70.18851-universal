'use client'
// Consultas do módulo operacional. Base portada do projeto Lovable (src/lib/ops-data.ts).
// Sempre filtradas por empresa no cliente; o RLS do banco garante o isolamento de verdade.
import { getSupabase } from '@/lib/supabase/client'
import type { EventStatus, ParticipantStatus } from '@/lib/erp/ops'

export interface TeamRow {
  id: string; name: string; quantity: number; rate: number; coordinator_name: string | null
  start_time: string | null; end_time: string | null; registrations_open: boolean; invite_token: string
}
export interface AttRow {
  kind: 'checkin' | 'checkout'; recorded_at: string; work_date: string; inside_radius: boolean | null; distance_m: number | null
  photo_path: string | null; accuracy_m: number | null; address: string | null
}
export interface PartRow {
  id: string; team_id: string; person_id: string; status: ParticipantStatus; worked: boolean | null; days: number; rate: number
  addition: number; discount: number; final_amount: number; validation_notes: string | null; created_at: string
  // PIX completo nunca vem por SELECT (o banco só libera a versão mascarada)
  people: { full_name: string; cpf: string; phone: string | null; email: string | null; pix_type: string | null; has_pix: boolean; pix_key_masked: string | null; pix_updated_publicly_at: string | null } | null
  attendance: AttRow[]
}
export interface EventRow {
  id: string; company_id: string; code: string; name: string; client_name: string | null; cost_center: string | null; event_date: string
  end_date: string | null; cliente_evento_id: string | null; centro_custo_id: string | null
  start_time: string | null; end_time: string | null; location: string | null; address: string | null; manager_name: string | null
  latitude: number | null; longitude: number | null; radius_m: number; notes: string | null; show_rate: boolean
  status: EventStatus; checkin_token: string; checkout_token: string
  event_teams: TeamRow[]; event_participants: PartRow[]
}

const EVENT_SELECT =
  '*, event_teams(*), event_participants(*, people(full_name, cpf, phone, email, pix_type, has_pix, pix_key_masked, pix_updated_publicly_at), attendance(kind, recorded_at, work_date, inside_radius, distance_m, photo_path, accuracy_m, address))'

export async function fetchEvents(companyIds: string[]): Promise<EventRow[]> {
  if (companyIds.length === 0) return []
  const { data, error } = await getSupabase().from('events').select(EVENT_SELECT).in('company_id', companyIds).order('event_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as EventRow[]
}

export async function fetchEvent(id: string): Promise<EventRow | null> {
  const { data, error } = await getSupabase().from('events').select(EVENT_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as EventRow | null
}

export interface EventStats {
  needed: number; enrolled: number; confirmed: number; waiting: number; present: number; checkedOut: number; open: number
  noShow: number; checkoutPending: number; incompleteTeams: number; plannedCost: number; confirmedCost: number; validatedCost: number
}

/** Indicadores do evento. Com `day`, presença considera só aquele dia (eventos de vários dias). */
export function eventStats(e: Pick<EventRow, 'event_teams' | 'event_participants'>, day?: string): EventStats {
  const onDay = (a: AttRow) => !day || a.work_date === day
  const conf = e.event_participants.filter((p) => p.status === 'confirmado')
  const present = conf.filter((p) => p.attendance.some((a) => a.kind === 'checkin' && onDay(a)))
  const out = conf.filter((p) => p.attendance.some((a) => a.kind === 'checkout' && onDay(a)))
  const needed = e.event_teams.reduce((s, t) => s + t.quantity, 0)
  const confIn = (teamId: string) => conf.filter((p) => p.team_id === teamId).length
  return {
    needed,
    enrolled: e.event_participants.filter((p) => p.status !== 'cancelado' && p.status !== 'recusado').length,
    confirmed: conf.length,
    waiting: e.event_participants.filter((p) => p.status === 'aguardando' || p.status === 'inscrito').length,
    present: present.length,
    checkedOut: out.length,
    open: e.event_teams.reduce((s, t) => s + Math.max(t.quantity - confIn(t.id), 0), 0),
    noShow: conf.length - present.length,
    checkoutPending: present.length - out.length,
    incompleteTeams: e.event_teams.filter((t) => confIn(t.id) < t.quantity).length,
    plannedCost: e.event_teams.reduce((s, t) => s + t.quantity * Number(t.rate), 0),
    confirmedCost: conf.reduce((s, p) => s + Number(p.rate ?? 0), 0),
    validatedCost: conf.filter((p) => p.worked).reduce((s, p) => s + Number(p.final_amount ?? 0), 0),
  }
}

export interface TeamStats {
  team: TeamRow; needed: number; confirmed: number; present: number; arrivedMissing: number; open: number; waiting: number
  plannedCost: number; confirmedCost: number; validatedCost: number
}

/** Painel por equipe: necessários, confirmados, presentes, confirmados que não chegaram, vagas, previsão financeira. */
export function teamStats(e: Pick<EventRow, 'event_teams' | 'event_participants'>, day?: string): TeamStats[] {
  return e.event_teams.map((t) => {
    const ps = e.event_participants.filter((p) => p.team_id === t.id)
    const conf = ps.filter((p) => p.status === 'confirmado')
    const present = conf.filter((p) => p.attendance.some((a) => a.kind === 'checkin' && (!day || a.work_date === day))).length
    return {
      team: t, needed: t.quantity, confirmed: conf.length, present,
      arrivedMissing: conf.length - present,
      open: Math.max(t.quantity - conf.length, 0),
      waiting: ps.filter((p) => p.status === 'aguardando' || p.status === 'inscrito').length,
      plannedCost: t.quantity * Number(t.rate),
      confirmedCost: conf.reduce((s, p) => s + Number(p.rate ?? 0), 0),
      validatedCost: conf.filter((p) => p.worked).reduce((s, p) => s + Number(p.final_amount ?? 0), 0),
    }
  })
}

export function teamCounts(e: EventRow) {
  return e.event_teams.map((t) => ({
    quantity: t.quantity,
    confirmed: e.event_participants.filter((p) => p.team_id === t.id && p.status === 'confirmado').length,
  }))
}

// ── Mutações ────────────────────────────────────────────────────────────────

export async function setParticipantStatus(id: string, status: ParticipantStatus) {
  const { error } = await getSupabase().from('event_participants').update({ status }).eq('id', id)
  if (error) throw error
}

export async function updateParticipantClosing(id: string, patch: { worked?: boolean | null; days?: number; addition?: number; discount?: number; validation_notes?: string | null }) {
  const { error } = await getSupabase().from('event_participants').update(patch).eq('id', id)
  if (error) throw error
}

export async function setTeamRegistrations(teamId: string, open: boolean) {
  const { error } = await getSupabase().from('event_teams').update({ registrations_open: open }).eq('id', teamId)
  if (error) throw error
}

export async function finishEvent(eventId: string) {
  const { error } = await getSupabase().rpc('event_finish', { _event_id: eventId })
  if (error) throw error
}

export async function sendEventToFinance(eventId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('event_send_to_finance', { _event_id: eventId })
  if (error) throw error
  return data ?? 0
}

export async function presencePhotoUrl(path: string): Promise<string | null> {
  const { data } = await getSupabase().storage.from('presence-photos').createSignedUrl(path, 600)
  return data?.signedUrl ?? null
}

// ── Contas a pagar ──────────────────────────────────────────────────────────

export interface PayableRow {
  id: string; company_id: string; status: string; origin: string; amount: number; description: string
  payee_name: string | null; payee_document: string | null; pix_type: string | null; pix_key: string | null
  op_code: string | null; op_name: string | null; ref_date: string | null; competence: string | null
  cost_center: string | null; due_date: string | null; created_at: string
}

export async function fetchPayables(companyIds: string[]): Promise<PayableRow[]> {
  if (companyIds.length === 0) return []
  const { data, error } = await getSupabase()
    .from('payables')
    .select('id, company_id, status, origin, amount, description, payee_name, payee_document, pix_type, pix_key, op_code, op_name, ref_date, competence, cost_center, due_date, created_at')
    .in('company_id', companyIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as PayableRow[]
}

/** Lançamentos de um evento (operation_id = id do evento). */
export async function fetchEventPayables(eventId: string): Promise<PayableRow[]> {
  const { data, error } = await getSupabase()
    .from('payables')
    .select('id, company_id, status, origin, amount, description, payee_name, payee_document, pix_type, pix_key, op_code, op_name, ref_date, competence, cost_center, due_date, created_at')
    .eq('operation_id', eventId)
  if (error) throw error
  return (data ?? []) as unknown as PayableRow[]
}

// ── Responsáveis da operação (evento ou ponto fixo) ─────────────────────────

export interface MemberRow { user_id: string; full_name: string; email: string; role: 'responsavel' | 'coordenador' | 'lider' }

export async function fetchMembers(operationId: string): Promise<MemberRow[]> {
  const { data, error } = await getSupabase().rpc('operation_members_list', { _op: operationId })
  if (error) throw error
  return (data ?? []) as MemberRow[]
}

export async function fetchAssignableUsers(companyId: string) {
  const { data, error } = await getSupabase().rpc('company_assignable_users', { _company_id: companyId })
  if (error) throw error
  return data ?? []
}

export async function setMember(operationId: string, userId: string, role: MemberRow['role'], remove = false) {
  const { error } = await getSupabase().rpc('operation_member_set', { _op: operationId, _user: userId, _role: role, _remove: remove })
  if (error) throw error
}

/** Gera link novo (o anterior para de funcionar na hora). */
export async function rotateLink(kind: 'inscricao' | 'checkin' | 'checkout', id: string) {
  const { error } = await getSupabase().rpc('rotate_link', { _kind: kind, _id: id })
  if (error) throw error
}

export async function updateEventRefs(eventId: string, clienteId: string | null, ccId: string | null, endDate: string | null) {
  const { error } = await getSupabase().rpc('event_update_refs', { _event_id: eventId, _cliente: clienteId as string, _cc: ccId as string, _end_date: endDate as string })
  if (error) throw error
}
