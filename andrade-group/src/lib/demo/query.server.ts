import 'server-only'
// Equivalente mínimo ao PostgREST para as tabelas que o app lê/grava via `.from(...)`. Não é genérico
// de propósito: implementa só a combinação exata de filtros/operações que o código já usa (mapeada em
// src/lib/erp/*-data.ts e nos componentes 'use client' do ERP) — ver MAPA_DO_PROJETO.md.
import {
  getStore, newId, nowIso, recomputeParticipantFinal, recomputePeriodItemFinal, saveStore,
  type CentroCusto, type Cliente, type EventRaw, type FixedPostRaw, type Fornecedor,
  type ParticipantRaw, type PayableRaw, type PeriodItemRaw, type PersonRaw, type Store,
} from './store.server'
import {
  shapeCentro, shapeCliente, shapeEvent, shapeFixedPost, shapeFornecedor, shapePayable, shapePerson,
} from './shape.server'

export type FilterOp = 'eq' | 'in' | 'like' | 'ilike'
export interface Filter { op: FilterOp; col: string; val: unknown }
export interface FromRequest {
  table: string
  filters: Filter[]
  order?: { col: string; ascending: boolean }
  limit?: number
  mode: 'many' | 'maybeSingle' | 'single'
  write?: { kind: 'update'; patch: Record<string, unknown> } | { kind: 'insert'; rows: Record<string, unknown>[] }
  wantsSelect: boolean
}
export interface FromResult { data: unknown; error: { message: string } | null }

function likeToRegExp(pattern: string, ci: boolean): RegExp {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
  return new RegExp(`^${esc}$`, ci ? 'i' : undefined)
}

function matches(row: Record<string, unknown>, f: Filter): boolean {
  const v = row[f.col]
  switch (f.op) {
    case 'eq': return v === f.val
    case 'in': return Array.isArray(f.val) && (f.val as unknown[]).includes(v)
    case 'like': return typeof v === 'string' && likeToRegExp(String(f.val), false).test(v)
    case 'ilike': return typeof v === 'string' && likeToRegExp(String(f.val), true).test(v)
    default: return true
  }
}

function applyFilters<T extends Record<string, unknown>>(rows: T[], filters: Filter[]): T[] {
  return rows.filter((r) => filters.every((f) => matches(r, f)))
}

function applyOrder<T extends Record<string, unknown>>(rows: T[], order?: { col: string; ascending: boolean }): T[] {
  if (!order) return rows
  const sorted = [...rows].sort((a, b) => {
    const av = a[order.col], bv = b[order.col]
    if (av == null && bv == null) return 0
    if (av == null) return -1
    if (bv == null) return 1
    return String(av).localeCompare(String(bv), 'pt-BR')
  })
  return order.ascending ? sorted : sorted.reverse()
}

function finish(mode: FromRequest['mode'], rows: unknown[]): FromResult {
  if (mode === 'single') return rows[0] !== undefined ? { data: rows[0], error: null } : { data: null, error: { message: 'Nenhum registro encontrado.' } }
  if (mode === 'maybeSingle') return { data: rows[0] ?? null, error: null }
  return { data: rows, error: null }
}

type TableAccessor<Raw> = { list: Raw[]; shape: (store: Store, row: Raw) => unknown; defaults: () => Partial<Raw> }

function accessorFor(table: string, store: Store): TableAccessor<Record<string, unknown>> | null {
  switch (table) {
    case 'events':
      return { list: store.events as unknown as Record<string, unknown>[], shape: (s, r) => shapeEvent(s, r as unknown as EventRaw), defaults: () => ({}) }
    case 'people':
      return { list: store.people as unknown as Record<string, unknown>[], shape: (s, r) => shapePerson(s, r as unknown as PersonRaw), defaults: () => ({}) }
    case 'payables':
      return { list: store.payables as unknown as Record<string, unknown>[], shape: (_s, r) => shapePayable(r as unknown as PayableRaw), defaults: () => ({}) }
    case 'fixed_posts':
      return { list: store.fixedPosts as unknown as Record<string, unknown>[], shape: (s, r) => shapeFixedPost(s, r as unknown as FixedPostRaw), defaults: () => ({ status: 'ativo', planned_headcount: 0, created_at: nowIso() }) }
    case 'clientes_evento':
      return { list: store.clientesEvento as unknown as Record<string, unknown>[], shape: (_s, r) => shapeCliente(r as unknown as Cliente), defaults: () => ({ status: 'ativo' }) }
    case 'centros_custo':
      return { list: store.centrosCusto as unknown as Record<string, unknown>[], shape: (_s, r) => shapeCentro(r as unknown as CentroCusto), defaults: () => ({ status: 'ativo' }) }
    case 'fornecedores':
      return { list: store.fornecedores as unknown as Record<string, unknown>[], shape: (_s, r) => shapeFornecedor(r as unknown as Fornecedor), defaults: () => ({ status: 'ativo' }) }
    case 'fixed_post_members':
      return { list: store.fixedPostMembers as unknown as Record<string, unknown>[], shape: (_s, r) => r, defaults: () => ({ status: 'ativo' }) }
    default:
      return null
  }
}

/** Tabelas cuja escrita (`update`) recomputa um campo "gerado" (espelhando a coluna gerada do Postgres). */
function postUpdateHook(table: string, row: Record<string, unknown>) {
  if (table === 'event_participants') recomputeParticipantFinal(row as unknown as ParticipantRaw)
  if (table === 'fixed_post_period_items') recomputePeriodItemFinal(row as unknown as PeriodItemRaw)
}

export function execFrom(req: FromRequest): FromResult {
  const store = getStore()

  // event_teams e event_participants só são gravados (update) — nunca lidos via `.from()` isolado.
  if (req.table === 'event_teams' && req.write?.kind === 'update') {
    return doUpdate(store.eventTeams as unknown as Record<string, unknown>[], req, undefined)
  }
  if (req.table === 'event_participants' && req.write?.kind === 'update') {
    return doUpdate(store.eventParticipants as unknown as Record<string, unknown>[], req, (r) => postUpdateHook('event_participants', r))
  }
  if (req.table === 'fixed_post_period_items' && req.write?.kind === 'update') {
    return doUpdate(store.fixedPostPeriodItems as unknown as Record<string, unknown>[], req, (r) => postUpdateHook('fixed_post_period_items', r))
  }

  const acc = accessorFor(req.table, store)
  if (!acc) return { data: null, error: { message: `Tabela não suportada no modo demo: ${req.table}` } }

  if (req.write?.kind === 'update') return doUpdate(acc.list, req, undefined, (s, r) => acc.shape(s, r))
  if (req.write?.kind === 'insert') return doInsert(acc, req)

  // select
  const filtered = applyOrder(applyFilters(acc.list, req.filters), req.order)
  const limited = req.limit != null ? filtered.slice(0, req.limit) : filtered
  const shaped = limited.map((r) => acc.shape(store, r))
  return finish(req.mode, shaped)
}

function doUpdate(
  list: Record<string, unknown>[], req: FromRequest, hook?: (row: Record<string, unknown>) => void,
  shape?: (store: Store, row: Record<string, unknown>) => unknown,
): FromResult {
  if (req.write?.kind !== 'update') return { data: null, error: { message: 'operação inválida' } }
  const matched = applyFilters(list, req.filters)
  if (matched.length === 0) return { data: null, error: { message: 'Registro não encontrado.' } }
  for (const row of matched) {
    Object.assign(row, req.write.patch)
    hook?.(row)
  }
  saveStore()
  if (!req.wantsSelect) return { data: null, error: null }
  const store = getStore()
  const out = matched.map((r) => (shape ? shape(store, r) : r))
  return finish(req.mode, out)
}

function doInsert(acc: TableAccessor<Record<string, unknown>>, req: FromRequest): FromResult {
  if (req.write?.kind !== 'insert') return { data: null, error: { message: 'operação inválida' } }
  const created = req.write.rows.map((row) => {
    const full: Record<string, unknown> = { id: newId(), ...acc.defaults(), ...row }
    acc.list.push(full)
    return full
  })
  saveStore()
  if (!req.wantsSelect) return { data: null, error: null }
  const store = getStore()
  const out = created.map((r) => acc.shape(store, r))
  return finish(req.mode, out)
}
