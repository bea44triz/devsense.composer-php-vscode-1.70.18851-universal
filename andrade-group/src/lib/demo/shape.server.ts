import 'server-only'
// Monta os objetos aninhados (equivalente aos "embeds" do PostgREST, ex.: event_teams(*), people(...))
// a partir do armazém plano. Sempre devolve a forma mais completa usada em qualquer tela: campos a
// mais do que um `select()` específico pediria são inofensivos (o código do app só lê o que usa).
import {
  centroLabel, clienteNome, maskPixKey, personToProfile, type AttendanceRaw, type CentroCusto, type Cliente,
  type EventRaw, type FixedMemberRaw, type FixedPostRaw, type Fornecedor, type ParticipantRaw, type PayableRaw,
  type PeriodItemRaw, type PeriodRaw, type PersonRaw, type Store, type TeamRaw,
} from './store.server'

function attendanceOf(store: Store, participantId: string): AttendanceRaw[] {
  return store.attendance.filter((a) => a.event_participant_id === participantId).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
}

function peopleEmbed(p: PersonRaw) {
  return {
    full_name: p.full_name, cpf: p.cpf, phone: p.phone, email: p.email, pix_type: p.pix_type,
    has_pix: !!p.pix_key, pix_key_masked: maskPixKey(p.pix_key), pix_updated_publicly_at: p.pix_updated_publicly_at,
  }
}

export function shapeParticipant(store: Store, p: ParticipantRaw) {
  const person = store.people.find((x) => x.id === p.person_id) ?? null
  return {
    id: p.id, team_id: p.team_id, person_id: p.person_id, status: p.status, worked: p.worked, days: p.days,
    rate: p.rate, addition: p.addition, discount: p.discount, final_amount: p.final_amount,
    validation_notes: p.validation_notes, created_at: p.created_at,
    people: person ? peopleEmbed(person) : null,
    attendance: attendanceOf(store, p.id),
  }
}

export function shapeTeam(t: TeamRaw) {
  return {
    id: t.id, name: t.name, quantity: t.quantity, rate: t.rate, coordinator_name: t.coordinator_name,
    start_time: t.start_time, end_time: t.end_time, registrations_open: t.registrations_open, invite_token: t.invite_token,
  }
}

export function shapeEvent(store: Store, e: EventRaw) {
  const teams = store.eventTeams.filter((t) => t.event_id === e.id)
  const participants = store.eventParticipants.filter((p) => p.event_id === e.id)
  return {
    id: e.id, company_id: e.company_id, code: e.code, name: e.name,
    client_name: clienteNome(store, e.cliente_evento_id), cost_center: centroLabel(store, e.centro_custo_id),
    event_date: e.event_date, end_date: e.end_date, cliente_evento_id: e.cliente_evento_id, centro_custo_id: e.centro_custo_id,
    start_time: e.start_time, end_time: e.end_time, location: e.location, address: e.address, manager_name: e.manager_name,
    latitude: e.latitude, longitude: e.longitude, radius_m: e.radius_m, notes: e.notes, show_rate: e.show_rate,
    status: e.status, checkin_token: e.checkin_token, checkout_token: e.checkout_token,
    event_teams: teams.map(shapeTeam),
    event_participants: participants.map((p) => shapeParticipant(store, p)),
  }
}

export function shapePayable(p: PayableRaw) {
  return { ...p }
}

export function shapeCliente(c: Cliente) { return { ...c } }
export function shapeCentro(c: CentroCusto) { return { ...c } }
export function shapeFornecedor(f: Fornecedor) {
  return {
    id: f.id, company_id: f.company_id, razao_social: f.razao_social, nome_fantasia: f.nome_fantasia,
    documento: f.documento, telefone: f.telefone, email: f.email, pix_type: f.pix_type,
    has_pix: !!f.pix_key, pix_key_masked: maskPixKey(f.pix_key), servico: f.servico, status: f.status,
  }
}

function fixedMemberEmbed(store: Store, m: FixedMemberRaw) {
  const person = store.people.find((x) => x.id === m.person_id) ?? null
  return {
    id: m.id, person_id: m.person_id, role: m.role, start_date: m.start_date, end_date: m.end_date,
    monthly_rate: m.monthly_rate, status: m.status,
    people: person ? { full_name: person.full_name, cpf: person.cpf, phone: person.phone, has_pix: !!person.pix_key } : null,
  }
}

function periodItemEmbed(store: Store, i: PeriodItemRaw) {
  const person = store.people.find((x) => x.id === i.person_id) ?? null
  return {
    id: i.id, period_id: i.period_id, member_id: i.member_id, person_id: i.person_id, base_amount: i.base_amount,
    absences: i.absences, discount: i.discount, addition: i.addition, final_amount: i.final_amount,
    notes: i.notes, status: i.status,
    people: person ? { full_name: person.full_name, cpf: person.cpf, has_pix: !!person.pix_key, pix_updated_publicly_at: person.pix_updated_publicly_at } : null,
  }
}

function periodEmbed(store: Store, p: PeriodRaw) {
  const items = store.fixedPostPeriodItems.filter((i) => i.period_id === p.id)
  return {
    id: p.id, competence: p.competence, status: p.status, validated_at: p.validated_at, sent_at: p.sent_at,
    fixed_post_period_items: items.map((i) => periodItemEmbed(store, i)),
  }
}

export function shapeFixedPost(store: Store, fp: FixedPostRaw) {
  const members = store.fixedPostMembers.filter((m) => m.fixed_post_id === fp.id)
  const periods = store.fixedPostPeriods.filter((p) => p.fixed_post_id === fp.id)
  return {
    id: fp.id, company_id: fp.company_id, code: fp.code, name: fp.name,
    client_name: clienteNome(store, fp.cliente_evento_id), cost_center: centroLabel(store, fp.centro_custo_id),
    cliente_evento_id: fp.cliente_evento_id, centro_custo_id: fp.centro_custo_id, category: fp.category, subcategory: fp.subcategory,
    location: fp.location, address: fp.address, manager_name: fp.manager_name, planned_headcount: fp.planned_headcount,
    start_date: fp.start_date, notes: fp.notes, status: fp.status, created_at: fp.created_at,
    fixed_post_members: members.map((m) => fixedMemberEmbed(store, m)),
    fixed_post_periods: periods.map((p) => periodEmbed(store, p)),
  }
}

function eventParticipantEmbedForPerson(store: Store, p: ParticipantRaw) {
  const team = store.eventTeams.find((t) => t.id === p.team_id) ?? null
  const ev = store.events.find((e) => e.id === p.event_id) ?? null
  return {
    id: p.id, status: p.status, worked: p.worked, days: p.days, final_amount: p.final_amount,
    event_teams: team ? { name: team.name } : null,
    events: ev ? { id: ev.id, code: ev.code, name: ev.name, event_date: ev.event_date, end_date: ev.end_date } : null,
    attendance: attendanceOf(store, p.id).map((a) => ({ kind: a.kind, work_date: a.work_date, recorded_at: a.recorded_at, inside_radius: a.inside_radius })),
  }
}

function fixedMemberEmbedForPerson(store: Store, m: FixedMemberRaw) {
  const fp = store.fixedPosts.find((x) => x.id === m.fixed_post_id) ?? null
  return {
    id: m.id, role: m.role, start_date: m.start_date, end_date: m.end_date, monthly_rate: m.monthly_rate, status: m.status,
    fixed_posts: fp ? { id: fp.id, code: fp.code, name: fp.name, category: fp.category, subcategory: fp.subcategory } : null,
  }
}

/** Forma mais completa de `people` (cobre fetchPeople/searchPeople/fetchPerson — ver nota no topo do arquivo). */
export function shapePerson(store: Store, p: PersonRaw) {
  const participants = store.eventParticipants.filter((x) => x.person_id === p.id)
  const members = store.fixedPostMembers.filter((x) => x.person_id === p.id)
  return {
    ...personToProfile(p),
    event_participants: participants.map((x) => eventParticipantEmbedForPerson(store, x)),
    fixed_post_members: members.map((x) => fixedMemberEmbedForPerson(store, x)),
  }
}
