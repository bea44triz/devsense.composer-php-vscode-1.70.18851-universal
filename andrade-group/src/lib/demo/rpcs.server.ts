import 'server-only'
// Reimplementação em TS das funções do Postgres (RPCs) que o app chama via `.rpc(nome, args)`.
// Cobre só os nomes realmente usados no código (ver MAPA_DO_PROJETO.md / src/lib/erp/*-data.ts).
import { haversineMeters, todayISO } from '@/lib/erp/ops'
import { normalizePixKey, onlyDigits } from '@/lib/utils'
import {
  DemoError, TENANT, centroLabel, currentUser, getStore,
  newId, newToken, nowIso, recomputeParticipantFinal, saveStore, signIn, signOutSession, validateRegistration,
  type AttendanceRaw, type DemoUser, type EventRaw, type FixedPostRaw, type ParticipantRaw, type PayableRaw,
  type PeriodItemRaw, type PersonRaw, type Store, type TeamRaw,
} from './store.server'

export interface RpcResult { data: unknown; error: { message: string; code?: string } | null }
export interface RpcCtx { sessionId: string | null }

function ok(data: unknown): RpcResult { return { data, error: null } }
function fail(message: string, code?: string): RpcResult { return { data: null, error: code ? { message, code } : { message } } }

function requireUser(ctx: RpcCtx): DemoUser {
  const u = currentUser(ctx.sessionId)
  if (!u) throw new DemoError('Sessão expirada. Entre novamente.')
  return u
}

function findEventByAnyToken(store: Store, token: string): { event: EventRaw; kind: 'checkin' | 'checkout' } | null {
  const byIn = store.events.find((e) => e.checkin_token === token)
  if (byIn) return { event: byIn, kind: 'checkin' }
  const byOut = store.events.find((e) => e.checkout_token === token)
  if (byOut) return { event: byOut, kind: 'checkout' }
  return null
}

function findTeamByToken(store: Store, token: string): { team: TeamRaw; event: EventRaw } | null {
  const team = store.eventTeams.find((t) => t.invite_token === token)
  if (!team) return null
  const event = store.events.find((e) => e.id === team.event_id)
  if (!event) return null
  return { team, event }
}

function confirmedCount(store: Store, teamId: string): number {
  return store.eventParticipants.filter((p) => p.team_id === teamId && p.status === 'confirmado').length
}

function findOrCreatePerson(store: Store, companyId: string, data: { cpf: string; full_name?: string; phone?: string; email?: string; pix_type?: string; pix_key?: string }): PersonRaw {
  const cpf = onlyDigits(data.cpf)
  let person = store.people.find((p) => p.company_id === companyId && p.cpf === cpf)
  if (!person) {
    person = {
      id: newId(), company_id: companyId, full_name: (data.full_name ?? '').trim(), cpf,
      phone: data.phone ? onlyDigits(data.phone) : null, email: data.email?.trim() || null,
      pix_type: data.pix_type || null, pix_key: data.pix_key ? normalizePixKey(data.pix_key, data.pix_type ?? '') : null,
      main_role: null, status: 'ativo', pix_updated_publicly_at: null, created_at: nowIso(),
    }
    store.people.push(person)
  } else {
    if (data.full_name?.trim()) person.full_name = data.full_name.trim()
    if (data.phone) person.phone = onlyDigits(data.phone)
    if (data.email) person.email = data.email.trim()
    if (data.pix_type && data.pix_key) {
      person.pix_type = data.pix_type
      person.pix_key = normalizePixKey(data.pix_key, data.pix_type)
      person.pix_updated_publicly_at = nowIso()
    }
  }
  return person
}

function generatePayablesForEvent(store: Store, event: EventRaw): number {
  const confirmed = store.eventParticipants.filter((p) => p.event_id === event.id && p.status === 'confirmado')
  let n = 0
  for (const p of confirmed) {
    recomputeParticipantFinal(p)
    if (!p.worked || !(p.final_amount > 0)) continue
    const person = store.people.find((x) => x.id === p.person_id)
    const team = store.eventTeams.find((t) => t.id === p.team_id)
    const payable: PayableRaw = {
      id: newId(), company_id: event.company_id, status: 'pendente_validacao', origin: 'EVENTO', amount: p.final_amount,
      description: `${event.name} — ${team?.name ?? ''}`, payee_name: person?.full_name ?? null, payee_document: person?.cpf ?? null,
      pix_type: person?.pix_type ?? null, pix_key: person?.pix_key ?? null, op_code: event.code, op_name: event.name,
      ref_date: event.event_date, competence: null, cost_center: centroLabel(store, event.centro_custo_id),
      due_date: event.event_date, created_at: nowIso(), operation_id: event.id, person_id: p.person_id,
    }
    store.payables.push(payable)
    n++
  }
  return n
}

// ── Dispatch ────────────────────────────────────────────────────────────────────────────────

export function callRpc(name: string, args: Record<string, unknown>, ctx: RpcCtx): RpcResult {
  try {
    const fn = HANDLERS[name]
    if (!fn) return fail(`RPC não suportada no modo demo: ${name}`)
    return fn(args, ctx)
  } catch (err) {
    if (err instanceof DemoError) return fail(err.message, err.code)
    return fail((err as Error).message || 'Erro inesperado no modo demo.')
  }
}

type Handler = (args: Record<string, unknown>, ctx: RpcCtx) => RpcResult

const HANDLERS: Record<string, Handler> = {
  // ── sessão / ambiente ──
  is_platform_admin: () => ok(false),
  my_tenants: () => ok([TENANT]),
  resolve_tenant: (args) => ok((args._slug === TENANT.slug || args._host) ? [TENANT] : []),
  is_group_admin: (_a, ctx) => ok(currentUser(ctx.sessionId)?.email === 'demo@061.test'),
  can_view_consolidated: () => ok(false),
  my_company_context: (_a, ctx) => {
    const user = requireUser(ctx)
    const store = getStore()
    return ok([{ company_id: store.company.id, name: store.company.name, color: null, permissions: user.permissions }])
  },

  // ── eventos ──
  event_create: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const e = args._event as Record<string, unknown>
    const teams = args._teams as Array<Record<string, unknown>>
    const event: EventRaw = {
      id: newId(), company_id: String(args._company_id), code: String(e.code ?? ''), name: String(e.name ?? ''),
      cliente_evento_id: (e.cliente_evento_id as string) || null, centro_custo_id: (e.centro_custo_id as string) || null,
      event_date: String(e.event_date ?? ''), end_date: (e.end_date as string) || null,
      start_time: (e.start_time as string) || null, end_time: (e.end_time as string) || null,
      location: (e.location as string) || null, address: (e.address as string) || null, manager_name: (e.manager_name as string) || null,
      latitude: e.latitude === '' || e.latitude == null ? null : Number(e.latitude),
      longitude: e.longitude === '' || e.longitude == null ? null : Number(e.longitude),
      radius_m: Number(e.radius_m) || 300, notes: (e.notes as string) || null, show_rate: e.show_rate !== false,
      status: 'inscricoes_abertas', checkin_token: newToken(), checkout_token: newToken(), created_at: nowIso(),
    }
    store.events.push(event)
    for (const t of teams) {
      const team: TeamRaw = {
        id: newId(), event_id: event.id, name: String(t.name ?? ''), quantity: Number(t.quantity) || 0, rate: Number(t.rate) || 0,
        coordinator_name: (t.coordinator_name as string) || null, start_time: (t.start_time as string) || null,
        end_time: (t.end_time as string) || null, registrations_open: true, invite_token: newToken(),
      }
      store.eventTeams.push(team)
    }
    saveStore()
    return ok(event.id)
  },
  event_finish: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const event = store.events.find((e) => e.id === args._event_id)
    if (!event) throw new DemoError('Evento não encontrado.')
    if (['fechado', 'cancelado', 'aguardando_fechamento'].includes(event.status)) throw new DemoError('Este evento já foi encerrado.')
    event.status = 'aguardando_fechamento'
    saveStore()
    return ok(null)
  },
  event_send_to_finance: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const event = store.events.find((e) => e.id === args._event_id)
    if (!event) throw new DemoError('Evento não encontrado.')
    if (event.status === 'fechado') throw new DemoError('Este evento já foi enviado ao financeiro.')
    const confirmed = store.eventParticipants.filter((p) => p.event_id === event.id && p.status === 'confirmado')
    if (confirmed.some((p) => p.worked === null || p.worked === undefined)) {
      throw new DemoError('Há profissionais confirmados sem validação de "trabalhou". Valide todos antes de enviar.')
    }
    const n = generatePayablesForEvent(store, event)
    event.status = 'fechado'
    saveStore()
    return ok(n)
  },
  event_update_refs: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const event = store.events.find((e) => e.id === args._event_id)
    if (!event) throw new DemoError('Evento não encontrado.')
    event.cliente_evento_id = (args._cliente as string) || null
    event.centro_custo_id = (args._cc as string) || null
    event.end_date = (args._end_date as string) || null
    saveStore()
    return ok(null)
  },
  rotate_link: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const kind = args._kind as string
    const id = args._id as string
    if (kind === 'inscricao') {
      const team = store.eventTeams.find((t) => t.id === id)
      if (!team) throw new DemoError('Equipe não encontrada.')
      team.invite_token = newToken()
    } else {
      const event = store.events.find((e) => e.id === id)
      if (!event) throw new DemoError('Evento não encontrado.')
      if (kind === 'checkin') event.checkin_token = newToken()
      else event.checkout_token = newToken()
    }
    saveStore()
    return ok(null)
  },

  // ── responsáveis da operação ──
  operation_members_list: (args) => {
    const store = getStore()
    const rows = store.operationMembers.filter((m) => m.operation_id === args._op).map((m) => {
      const u = store.users.find((x) => x.user_id === m.user_id)
      return { user_id: m.user_id, full_name: u?.full_name ?? m.user_id, email: u?.email ?? '', role: m.role }
    })
    return ok(rows)
  },
  company_assignable_users: () => {
    const store = getStore()
    return ok(store.users.map((u) => ({ user_id: u.user_id, full_name: u.full_name, email: u.email })))
  },
  operation_member_set: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const op = args._op as string, user = args._user as string, role = args._role as 'responsavel' | 'coordenador' | 'lider'
    store.operationMembers = store.operationMembers.filter((m) => !(m.operation_id === op && m.user_id === user))
    if (!args._remove) store.operationMembers.push({ operation_id: op, user_id: user, role })
    saveStore()
    return ok(null)
  },

  // ── links públicos: inscrição ──
  public_invite_info: (args) => {
    const store = getStore()
    const found = findTeamByToken(store, String(args._token))
    if (!found) return ok(null)
    const { team, event } = found
    const vacancies = Math.max(0, team.quantity - confirmedCount(store, team.id))
    return ok({
      team_name: team.name, event_name: event.name, event_code: event.code, company_name: store.company.name,
      event_date: event.event_date, end_date: event.end_date, start_time: team.start_time ?? event.start_time,
      end_time: team.end_time ?? event.end_time, location: event.location, address: event.address,
      rate: event.show_rate ? team.rate : null,
      open: team.registrations_open && !['fechado', 'cancelado', 'aguardando_fechamento'].includes(event.status),
      vacancies,
    })
  },
  public_invite_lookup: (args) => {
    const store = getStore()
    const found = findTeamByToken(store, String(args._token))
    if (!found) throw new DemoError('Link inválido.')
    const cpf = onlyDigits(args._cpf)
    const person = store.people.find((p) => p.company_id === found.event.company_id && p.cpf === cpf)
    if (!person) return ok({ found: false })
    const participation = store.eventParticipants.find((p) => p.event_id === found.event.id && p.team_id === found.team.id && p.person_id === person.id)
    return ok({ found: true, has_pix: !!person.pix_key, participation_status: participation?.status ?? null })
  },
  public_invite_register: (args) => {
    const store = getStore()
    const found = findTeamByToken(store, String(args._token))
    if (!found) throw new DemoError('Link inválido.')
    const { team, event } = found
    if (!team.registrations_open || ['fechado', 'cancelado', 'aguardando_fechamento'].includes(event.status)) {
      throw new DemoError('As inscrições para esta equipe estão encerradas.')
    }
    const data = args._data as { cpf: string; full_name?: string; phone?: string; email?: string; pix_type?: string; pix_key?: string }
    const cpf = onlyDigits(data.cpf)
    const existingPerson = store.people.find((p) => p.company_id === event.company_id && p.cpf === cpf)
    validateRegistration(data, !existingPerson)
    const person = findOrCreatePerson(store, event.company_id, data)
    const existing = store.eventParticipants.find((p) => p.event_id === event.id && p.team_id === team.id && p.person_id === person.id)
    if (existing) { saveStore(); return ok({ status: existing.status, already: true }) }
    const vacancies = team.quantity - confirmedCount(store, team.id)
    const participant: ParticipantRaw = {
      id: newId(), event_id: event.id, team_id: team.id, person_id: person.id,
      status: vacancies > 0 ? 'aguardando' : 'lista_espera', worked: null, days: 1, rate: team.rate, addition: 0,
      discount: 0, final_amount: 0, validation_notes: null, created_at: nowIso(),
    }
    store.eventParticipants.push(participant)
    saveStore()
    return ok({ status: participant.status, already: false })
  },

  // ── links públicos: presença ──
  public_presence_info: (args) => {
    const store = getStore()
    const found = findEventByAnyToken(store, String(args._token))
    if (!found) return ok(null)
    const { event, kind } = found
    return ok({
      kind, event_name: event.name, company_name: store.company.name, event_date: event.event_date, end_date: event.end_date,
      today: todayISO(), start_time: event.start_time, end_time: event.end_time, location: event.location, address: event.address,
      event_lat: event.latitude, event_lng: event.longitude, radius_m: event.radius_m,
      open: !['fechado', 'cancelado'].includes(event.status),
    })
  },
  public_presence_lookup: (args) => {
    const store = getStore()
    const found = findEventByAnyToken(store, String(args._token))
    if (!found) throw new DemoError('Link inválido.')
    const { event, kind } = found
    const cpf = onlyDigits(args._cpf)
    const person = store.people.find((p) => p.company_id === event.company_id && p.cpf === cpf)
    if (!person) return ok({ found: false })
    const participant = store.eventParticipants.find((p) => p.event_id === event.id && p.person_id === person.id && p.status === 'confirmado')
    if (!participant) return ok({ found: false })
    const team = store.eventTeams.find((t) => t.id === participant.team_id)
    const today = todayISO()
    const att = store.attendance.filter((a) => a.event_participant_id === participant.id)
    const checkinToday = att.some((a) => a.kind === 'checkin' && a.work_date === today)
    const checkoutToday = att.some((a) => a.kind === 'checkout' && a.work_date === today)
    const openDay = [...att].reverse().find((a) => a.kind === 'checkin' && !att.some((o) => o.kind === 'checkout' && o.work_date === a.work_date))
    const name = person.full_name.split(' ')
    const masked = name.length > 1 ? `${name[0]} ${name[name.length - 1][0]}.` : name[0]
    return ok({
      found: true, name: masked, team: team?.name ?? '',
      checkin_today: kind === 'checkin' ? checkinToday : undefined,
      open_shift: kind === 'checkout' ? (openDay?.work_date ?? (checkinToday && !checkoutToday ? today : null)) : undefined,
    })
  },
  record_presence: (args) => {
    const store = getStore()
    const found = findEventByAnyToken(store, String(args._token))
    if (!found) throw new DemoError('Link inválido.')
    const { event, kind } = found
    const cpf = onlyDigits(args._cpf)
    const person = store.people.find((p) => p.company_id === event.company_id && p.cpf === cpf)
    if (!person) throw new DemoError('Participação não encontrada.')
    const participant = store.eventParticipants.find((p) => p.event_id === event.id && p.person_id === person.id && p.status === 'confirmado')
    if (!participant) throw new DemoError('Participação não encontrada.')
    const today = todayISO()
    const att = store.attendance.filter((a) => a.event_participant_id === participant.id)
    let workDate = today
    if (kind === 'checkout') {
      const openShift = [...att].reverse().find((a) => a.kind === 'checkin' && !att.some((o) => o.kind === 'checkout' && o.work_date === a.work_date))
      if (!openShift) throw new DemoError('Não há check-in em aberto para registrar a saída.')
      workDate = openShift.work_date
    } else if (att.some((a) => a.kind === 'checkin' && a.work_date === today)) {
      throw new DemoError('Seu check-in de hoje já foi registrado.')
    }
    const lat = Number(args._lat), lng = Number(args._lng)
    const dist = event.latitude != null && event.longitude != null ? haversineMeters(lat, lng, event.latitude, event.longitude) : null
    const insideRadius = dist == null ? null : dist <= event.radius_m
    const row: AttendanceRaw = {
      id: newId(), event_participant_id: participant.id, kind, recorded_at: nowIso(), work_date: workDate,
      inside_radius: insideRadius, distance_m: dist, photo_path: (args._photo_path as string) ?? null,
      accuracy_m: args._accuracy != null ? Number(args._accuracy) : null, address: (args._address as string) ?? null,
    }
    store.attendance.push(row)
    saveStore()
    return ok({ recorded_at: row.recorded_at, inside_radius: row.inside_radius })
  },
  public_link_check: () => ok(true),
  presence_photo_folder: (args) => {
    const store = getStore()
    const found = findEventByAnyToken(store, String(args._token))
    if (!found) return ok(null)
    return ok(`${found.event.company_id}/${found.event.id}`)
  },

  // ── pessoas ──
  person_pix: (args) => {
    const store = getStore()
    const p = store.people.find((x) => x.id === args._person)
    return ok(p ? [{ pix_key: p.pix_key }] : [])
  },
  person_upsert: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const data = args._data as { cpf: string; full_name: string; phone?: string; email?: string; pix_type?: string; pix_key?: string; main_role?: string }
    const person = findOrCreatePerson(store, String(args._company_id), data)
    if (data.main_role) person.main_role = data.main_role
    saveStore()
    return ok(person.id)
  },
  fornecedor_pix: (args) => {
    const store = getStore()
    const f = store.fornecedores.find((x) => x.id === args._fornecedor)
    return ok(f ? [{ pix_key: f.pix_key }] : [])
  },

  // ── pontos fixos ──
  fixed_post_create: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const d = args._data as Record<string, unknown>
    const fp: FixedPostRaw = {
      id: newId(), company_id: String(args._company_id), code: String(d.code ?? ''), name: String(d.name ?? ''),
      cliente_evento_id: (d.cliente_evento_id as string) || null, centro_custo_id: (d.centro_custo_id as string) || null,
      category: (d.category as string) || null, subcategory: (d.subcategory as string) || null,
      location: (d.location as string) || null, address: (d.address as string) || null, manager_name: null,
      planned_headcount: 0, start_date: (d.start_date as string) || null, notes: (d.notes as string) || null,
      status: 'ativo', created_at: nowIso(),
    }
    store.fixedPosts.push(fp)
    if (d.responsavel_user_id) store.operationMembers.push({ operation_id: fp.id, user_id: String(d.responsavel_user_id), role: 'responsavel' })
    saveStore()
    return ok(fp.id)
  },
  fixed_post_open_period: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const postId = String(args._fixed_post_id), competence = String(args._competence)
    if (store.fixedPostPeriods.some((p) => p.fixed_post_id === postId && p.competence === competence)) {
      throw new DemoError('Já existe uma competência aberta para este mês.')
    }
    const period = { id: newId(), fixed_post_id: postId, competence, status: 'aberta' as const, validated_at: null, sent_at: null }
    store.fixedPostPeriods.push(period)
    const members = store.fixedPostMembers.filter((m) => m.fixed_post_id === postId && m.status === 'ativo')
    for (const m of members) {
      const item: PeriodItemRaw = {
        id: newId(), period_id: period.id, member_id: m.id, person_id: m.person_id, base_amount: m.monthly_rate,
        absences: 0, discount: 0, addition: 0, final_amount: m.monthly_rate, notes: null, status: 'pendente',
      }
      store.fixedPostPeriodItems.push(item)
    }
    saveStore()
    return ok(period.id)
  },
  fixed_post_validate_period: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const period = store.fixedPostPeriods.find((p) => p.id === args._period_id)
    if (!period) throw new DemoError('Competência não encontrada.')
    period.status = 'validada'
    period.validated_at = nowIso()
    saveStore()
    return ok(null)
  },
  fixed_post_reopen_period: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const period = store.fixedPostPeriods.find((p) => p.id === args._period_id)
    if (!period) throw new DemoError('Competência não encontrada.')
    if (period.status === 'enviada') throw new DemoError('Competência já enviada ao financeiro — não pode ser reaberta.')
    period.status = 'aberta'
    period.validated_at = null
    saveStore()
    return ok(null)
  },
  fixed_post_send_period: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const period = store.fixedPostPeriods.find((p) => p.id === args._period_id)
    if (!period) throw new DemoError('Competência não encontrada.')
    if (period.status !== 'validada') throw new DemoError('Valide a competência antes de enviar ao financeiro.')
    const post = store.fixedPosts.find((p) => p.id === period.fixed_post_id)
    if (!post) throw new DemoError('Ponto fixo não encontrado.')
    const items = store.fixedPostPeriodItems.filter((i) => i.period_id === period.id)
    let n = 0
    for (const i of items) {
      if (!(i.final_amount > 0)) continue
      const person = store.people.find((p) => p.id === i.person_id)
      store.payables.push({
        id: newId(), company_id: post.company_id, status: 'pendente_validacao', origin: 'PONTO_FIXO', amount: i.final_amount,
        description: post.name, payee_name: person?.full_name ?? null, payee_document: person?.cpf ?? null,
        pix_type: person?.pix_type ?? null, pix_key: person?.pix_key ?? null, op_code: post.code, op_name: post.name,
        ref_date: null, competence: period.competence, cost_center: centroLabel(store, post.centro_custo_id),
        due_date: null, created_at: nowIso(), operation_id: post.id, person_id: i.person_id,
      })
      n++
    }
    period.status = 'enviada'
    period.sent_at = nowIso()
    saveStore()
    return ok(n)
  },

  // ── usuários e permissões ──
  users_admin_list: () => {
    const store = getStore()
    return ok(store.users.map((u) => ({
      user_id: u.user_id, email: u.email, full_name: u.full_name, active: u.active, permissions: u.permissions,
      operations_count: store.operationMembers.filter((m) => m.user_id === u.user_id).length, is_platform_admin: u.is_platform_admin,
    })))
  },
  user_lookup_by_email: (args) => {
    const store = getStore()
    const email = String(args._email).trim().toLowerCase()
    return ok(store.users.filter((u) => u.email.toLowerCase().includes(email))
      .map((u) => ({ user_id: u.user_id, email: u.email, full_name: u.full_name, already_linked: true })))
  },
  company_user_set_access: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const user = store.users.find((u) => u.user_id === args._user_id)
    if (!user) throw new DemoError('Usuário não encontrado.')
    user.active = !!args._active
    user.permissions = (args._permissions as string[]) ?? []
    saveStore()
    return ok(null)
  },
  company_user_revoke: (args, ctx) => {
    requireUser(ctx)
    const store = getStore()
    const user = store.users.find((u) => u.user_id === args._user_id)
    if (!user) throw new DemoError('Usuário não encontrado.')
    user.active = false
    user.permissions = []
    saveStore()
    return ok(null)
  },
  user_operations_list: (args) => {
    const store = getStore()
    const userId = args._user_id as string
    return ok(store.operationMembers.filter((m) => m.user_id === userId).map((m) => {
      const ev = store.events.find((e) => e.id === m.operation_id)
      if (ev) return { operation_id: ev.id, type: 'EVENTO' as const, code: ev.code, name: ev.name, role: m.role, status: ev.status }
      const fp = store.fixedPosts.find((p) => p.id === m.operation_id)
      return { operation_id: fp?.id ?? m.operation_id, type: 'PONTO_FIXO' as const, code: fp?.code ?? '', name: fp?.name ?? '', role: m.role, status: fp?.status ?? '' }
    }))
  },
}

// ── auth (chamado pelo mock client, fora do dispatch de `.rpc()`) ────────────────────────────

export function authSignIn(email: string, password: string) {
  return signIn(email, password)
}
export function authSignOut(sessionId: string | null) {
  signOutSession(sessionId)
}
export function authGetUser(sessionId: string | null) {
  return currentUser(sessionId)
}
