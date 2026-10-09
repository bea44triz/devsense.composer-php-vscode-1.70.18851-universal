import 'server-only'
// Banco local da demonstração: substitui Supabase/Postgres/PostgREST por um armazém em memória
// (persistido em disco só para sobreviver a reinícios do `next dev`). Nenhuma rede, nenhum Postgres.
// Reaproveita as mesmas regras de negócio que o app já usa (validações, fórmulas de valor final etc.)
// para que o fluxo se comporte como o ERP real — só a camada de armazenamento muda.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { isValidCpf, isValidCelular, isValidEmail, isValidPixKey, normalizePixKey, onlyDigits } from '@/lib/utils'
import { participantFinal, periodItemFinal, todayISO } from '@/lib/erp/ops'

// ── Tipos das linhas "cruas" (sem embeds — os embeds são montados na leitura) ──────────────

export interface Company { id: string; name: string }
export interface DemoUser {
  user_id: string; email: string; password: string; full_name: string
  active: boolean; permissions: string[]; is_platform_admin: boolean
}
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
  telefone: string | null; email: string | null; pix_type: string | null; pix_key: string | null; servico: string | null; status: 'ativo' | 'inativo'
}
export interface PersonRaw {
  id: string; company_id: string; full_name: string; cpf: string; phone: string | null; email: string | null
  pix_type: string | null; pix_key: string | null; main_role: string | null; status: 'ativo' | 'bloqueado' | 'inativo'
  pix_updated_publicly_at: string | null; created_at: string
}
export interface EventRaw {
  id: string; company_id: string; code: string; name: string; cliente_evento_id: string | null; centro_custo_id: string | null
  event_date: string; end_date: string | null; start_time: string | null; end_time: string | null
  location: string | null; address: string | null; manager_name: string | null
  latitude: number | null; longitude: number | null; radius_m: number; notes: string | null; show_rate: boolean
  status: 'planejamento' | 'inscricoes_abertas' | 'em_andamento' | 'aguardando_fechamento' | 'fechado' | 'cancelado'
  checkin_token: string; checkout_token: string; created_at: string
}
export interface TeamRaw {
  id: string; event_id: string; name: string; quantity: number; rate: number; coordinator_name: string | null
  start_time: string | null; end_time: string | null; registrations_open: boolean; invite_token: string
}
export interface ParticipantRaw {
  id: string; event_id: string; team_id: string; person_id: string
  status: 'inscrito' | 'aguardando' | 'confirmado' | 'lista_espera' | 'recusado' | 'cancelado'
  worked: boolean | null; days: number; rate: number; addition: number; discount: number; final_amount: number
  validation_notes: string | null; created_at: string
}
export interface AttendanceRaw {
  id: string; event_participant_id: string; kind: 'checkin' | 'checkout'; recorded_at: string; work_date: string
  inside_radius: boolean | null; distance_m: number | null; photo_path: string | null; accuracy_m: number | null; address: string | null
}
export interface PayableRaw {
  id: string; company_id: string; status: string; origin: string; amount: number; description: string
  payee_name: string | null; payee_document: string | null; pix_type: string | null; pix_key: string | null
  op_code: string | null; op_name: string | null; ref_date: string | null; competence: string | null
  cost_center: string | null; due_date: string | null; created_at: string; operation_id: string; person_id: string | null
}
export interface FixedPostRaw {
  id: string; company_id: string; code: string; name: string; cliente_evento_id: string | null; centro_custo_id: string | null
  category: string | null; subcategory: string | null; location: string | null; address: string | null
  manager_name: string | null; planned_headcount: number; start_date: string | null; notes: string | null
  status: 'ativo' | 'suspenso' | 'encerrado'; created_at: string
}
export interface FixedMemberRaw {
  id: string; fixed_post_id: string; person_id: string; role: string | null; start_date: string; end_date: string | null
  monthly_rate: number; status: 'ativo' | 'inativo'
}
export interface PeriodRaw {
  id: string; fixed_post_id: string; competence: string; status: 'aberta' | 'validada' | 'enviada'
  validated_at: string | null; sent_at: string | null
}
export interface PeriodItemRaw {
  id: string; period_id: string; member_id: string; person_id: string; base_amount: number; absences: number
  discount: number; addition: number; final_amount: number; notes: string | null; status: 'pendente' | 'conferido'
}
export interface OperationMember { operation_id: string; user_id: string; role: 'responsavel' | 'coordenador' | 'lider' }

export interface Store {
  company: Company
  clientesEvento: Cliente[]
  centrosCusto: CentroCusto[]
  fornecedores: Fornecedor[]
  people: PersonRaw[]
  events: EventRaw[]
  eventTeams: TeamRaw[]
  eventParticipants: ParticipantRaw[]
  attendance: AttendanceRaw[]
  payables: PayableRaw[]
  fixedPosts: FixedPostRaw[]
  fixedPostMembers: FixedMemberRaw[]
  fixedPostPeriods: PeriodRaw[]
  fixedPostPeriodItems: PeriodItemRaw[]
  operationMembers: OperationMember[]
  users: DemoUser[]
  sessions: Record<string, string>
  photos: Record<string, string>
}

export const TENANT = { id: 'grp-demo', name: 'Grupo 061 Eventos', slug: 'demo' }
export const COMPANY_ID = 'comp-demo'
export const CLIENTE_DEMO_ID = 'cli-demo'
export const CC_DEMO_ID = 'cc-demo'
export const COORD_EMAIL = 'demo@061.test'
export const FIN_EMAIL = 'financeiro.demo@061.test'
const DEMO_PASSWORD = 'senha-teste'

function newId(): string {
  return crypto.randomUUID()
}
function newToken(): string {
  return crypto.randomBytes(16).toString('hex')
}
function nowIso(): string {
  return new Date().toISOString()
}

function seedStore(): Store {
  return {
    company: { id: COMPANY_ID, name: '061 Eventos (ambiente local de teste)' },
    clientesEvento: [{
      id: CLIENTE_DEMO_ID, company_id: COMPANY_ID, tipo_pessoa: 'PJ', razao_social: 'Cliente Demonstração',
      nome_fantasia: null, documento: null, telefone: null, email: null, status: 'ativo',
    }],
    centrosCusto: [{
      id: CC_DEMO_ID, company_id: COMPANY_ID, codigo: 'CC-DEMO', nome: 'Demonstração',
      origem: 'interno', id_externo: null, status: 'ativo',
    }],
    fornecedores: [],
    people: [],
    events: [],
    eventTeams: [],
    eventParticipants: [],
    attendance: [],
    payables: [],
    fixedPosts: [],
    fixedPostMembers: [],
    fixedPostPeriods: [],
    fixedPostPeriodItems: [],
    operationMembers: [],
    users: [
      {
        user_id: 'user-coord-demo', email: COORD_EMAIL, password: DEMO_PASSWORD, full_name: 'Coordenador Demonstração',
        active: true, is_platform_admin: false,
        permissions: ['operacao.gerenciar', 'operacao.todos', 'financeiro.ver', 'usuarios.gerenciar'],
      },
      {
        user_id: 'user-fin-demo', email: FIN_EMAIL, password: DEMO_PASSWORD, full_name: 'Financeiro Demonstração',
        active: true, is_platform_admin: false,
        permissions: ['financeiro.gerenciar'],
      },
    ],
    sessions: {},
    photos: {},
  }
}

// ── Persistência local (sobrevive a reinícios do `next dev`; `globalThis` sobrevive ao Fast Refresh) ──

const DATA_DIR = path.join(process.cwd(), '.demo-data')
const DATA_FILE = path.join(DATA_DIR, 'db.json')

declare global {
  var __erpDemoStore: Store | undefined
}

function loadFromDisk(): Store | null {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8')
    return JSON.parse(raw) as Store
  } catch {
    return null
  }
}

function persist(store: Store) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(DATA_FILE, JSON.stringify(store), 'utf8')
  } catch (err) {
    console.error('[demo] falha ao salvar dados locais:', (err as Error).message)
  }
}

export function getStore(): Store {
  if (!globalThis.__erpDemoStore) {
    globalThis.__erpDemoStore = loadFromDisk() ?? seedStore()
  }
  return globalThis.__erpDemoStore
}

export function saveStore() {
  persist(getStore())
}

export function resetStore(): Store {
  globalThis.__erpDemoStore = seedStore()
  persist(globalThis.__erpDemoStore)
  return globalThis.__erpDemoStore
}

// ── Erros de regra de negócio (equivalente ao P0001 do Postgres) ──────────────────────────

export class DemoError extends Error {
  code = 'P0001'
  constructor(message: string) { super(message) }
}

// ── Sessão (equivalente simplificado ao Supabase Auth) ─────────────────────────────────────

export function currentUser(sessionId: string | null): DemoUser | null {
  if (!sessionId) return null
  const store = getStore()
  const userId = store.sessions[sessionId]
  if (!userId) return null
  return store.users.find((u) => u.user_id === userId) ?? null
}

export function signIn(email: string, password: string): { sessionId: string; user: DemoUser } | null {
  const store = getStore()
  const user = store.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password && u.active)
  if (!user) return null
  const sessionId = crypto.randomBytes(24).toString('hex')
  store.sessions[sessionId] = user.user_id
  saveStore()
  return { sessionId, user }
}

export function signOutSession(sessionId: string | null) {
  if (!sessionId) return
  const store = getStore()
  delete store.sessions[sessionId]
  saveStore()
}

// ── Masking de PIX para exibição (equivalente simplificado ao que o banco faz) ─────────────

export function maskPixKey(key: string | null): string | null {
  if (!key) return null
  if (key.length <= 4) return '***'
  return `***${key.slice(-4)}`
}

export function personToProfile(p: PersonRaw) {
  return {
    id: p.id, company_id: p.company_id, full_name: p.full_name, cpf: p.cpf, phone: p.phone, email: p.email,
    pix_type: p.pix_type, has_pix: !!p.pix_key, pix_key_masked: maskPixKey(p.pix_key), main_role: p.main_role,
    status: p.status, pix_updated_publicly_at: p.pix_updated_publicly_at, created_at: p.created_at,
  }
}

// ── Validação (reaproveita as mesmas regras do front, espelhando o que as RPCs do banco fariam) ──

export function validateRegistration(data: { cpf: string; full_name?: string; phone?: string; email?: string; pix_type?: string; pix_key?: string }, isNew: boolean) {
  if (!isValidCpf(data.cpf)) throw new DemoError('CPF inválido.')
  if (isNew && !(data.full_name ?? '').trim()) throw new DemoError('Informe o nome completo.')
  if ((isNew || data.phone) && !isValidCelular(data.phone ?? '')) throw new DemoError('Celular inválido.')
  if ((isNew || data.email) && !isValidEmail(data.email ?? '')) throw new DemoError('E-mail inválido.')
  if (data.pix_type || data.pix_key) {
    if (!data.pix_type || !isValidPixKey(data.pix_key ?? '', data.pix_type)) throw new DemoError('Chave PIX inválida para o tipo escolhido.')
  }
}

// ── Geração de valores finais (equivalente às colunas geradas do Postgres) ─────────────────

export function recomputeParticipantFinal(p: ParticipantRaw) {
  p.final_amount = participantFinal({ worked: p.worked, days: p.days, rate: p.rate, addition: p.addition, discount: p.discount })
}
export function recomputePeriodItemFinal(i: PeriodItemRaw) {
  i.final_amount = periodItemFinal({ base_amount: i.base_amount, addition: i.addition, discount: i.discount })
}

export function clienteNome(store: Store, id: string | null): string | null {
  if (!id) return null
  const c = store.clientesEvento.find((x) => x.id === id)
  return c ? (c.nome_fantasia || c.razao_social) : null
}
export function centroLabel(store: Store, id: string | null): string | null {
  if (!id) return null
  const c = store.centrosCusto.find((x) => x.id === id)
  return c ? `${c.codigo} — ${c.nome}` : null
}

// ── "Storage" de fotos (substitui o bucket privado do Supabase Storage) ────────────────────
// Guarda a foto como data URL direto no armazém local — simples o bastante para uma demo e
// evita servir bytes por uma rota própria (o <img src> aceita data URL diretamente).

export function storagePhotoUpload(path: string, bytes: Buffer, contentType: string) {
  const store = getStore()
  store.photos[path] = `data:${contentType};base64,${bytes.toString('base64')}`
  saveStore()
}
export function storagePhotoRemove(path: string) {
  const store = getStore()
  delete store.photos[path]
  saveStore()
}
export function storagePhotoDataUrl(path: string): string | null {
  return getStore().photos[path] ?? null
}

export { newId, newToken, nowIso, onlyDigits, normalizePixKey, todayISO }
