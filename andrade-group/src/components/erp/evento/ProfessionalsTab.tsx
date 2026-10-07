'use client'
import { useState } from 'react'
import { Check, Clock, MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { maskCpf, PARTICIPANT_LABEL, type ParticipantStatus } from '@/lib/erp/ops'
import { setParticipantStatus, type EventRow, type PartRow } from '@/lib/erp/ops-data'
import { EmptyState, ErrorBox, Pill, type Tone } from '../ui'

const STATUS_TONE: Record<ParticipantStatus, Tone> = {
  inscrito: 'info', aguardando: 'info', confirmado: 'success', lista_espera: 'warning', recusado: 'danger', cancelado: 'muted',
}
type Filtro = 'aguardando' | 'confirmado' | 'lista_espera' | 'outros' | 'todos'
const FILTROS: [Filtro, string][] = [['aguardando', 'Aguardando'], ['confirmado', 'Confirmados'], ['lista_espera', 'Lista de espera'], ['outros', 'Recusados/Cancelados'], ['todos', 'Todos']]

function matches(p: PartRow, f: Filtro) {
  if (f === 'todos') return true
  if (f === 'aguardando') return p.status === 'aguardando' || p.status === 'inscrito'
  if (f === 'outros') return p.status === 'recusado' || p.status === 'cancelado'
  return p.status === f
}

export function ProfessionalsTab({ e, canOperate, teamFilter, setTeamFilter, onChanged }: {
  e: EventRow; canOperate: boolean; teamFilter: string | null; setTeamFilter: (id: string | null) => void; onChanged: () => void
}) {
  const waiting = e.event_participants.filter((p) => matches(p, 'aguardando')).length
  const [filtro, setFiltro] = useState<Filtro>(waiting > 0 ? 'aguardando' : 'todos')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const locked = e.status === 'fechado' || e.status === 'cancelado'
  const teamName = (id: string) => e.event_teams.find((t) => t.id === id)?.name ?? ''

  const list = e.event_participants
    .filter((p) => (!teamFilter || p.team_id === teamFilter) && matches(p, filtro))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  const act = async (p: PartRow, status: ParticipantStatus) => {
    setErr(null); setBusy(p.id)
    try { await setParticipantStatus(p.id, status); onChanged() } catch (x) { setErr((x as Error).message) }
    setBusy(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={teamFilter ?? ''} onChange={(ev) => setTeamFilter(ev.target.value || null)}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          <option value="">Todas as equipes</option>
          {e.event_teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
          {FILTROS.map(([k, l]) => (
            <button key={k} onClick={() => setFiltro(k)} className={cn('whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold', filtro === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
              {l}{k === 'aguardando' && waiting > 0 && <span className="ml-1 rounded-full bg-sky-500 px-1.5 text-[10px] text-white">{waiting}</span>}
            </button>
          ))}
        </div>
      </div>
      {err && <ErrorBox>{err}</ErrorBox>}
      {list.length === 0 ? <EmptyState title="Ninguém nesta lista" text="Compartilhe o link de inscrição da equipe para receber profissionais." /> : (
        <ul className="space-y-2">
          {list.map((p) => {
            const checkin = p.attendance.find((a) => a.kind === 'checkin')
            const phone = p.people?.phone ?? ''
            return (
              <li key={p.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-600">
                    {(p.people?.full_name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-slate-800">{p.people?.full_name}</div>
                    <div className="text-xs text-slate-400">{teamName(p.team_id)} · CPF {maskCpf(p.people?.cpf ?? '')}{checkin && ' · presente'}</div>
                  </div>
                  <Pill tone={STATUS_TONE[p.status]}>{PARTICIPANT_LABEL[p.status]}</Pill>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-[52px]">
                  {phone && (
                    <a href={`https://wa.me/55${phone}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                      <MessageCircle className="h-3.5 w-3.5" />WhatsApp
                    </a>
                  )}
                  {canOperate && !locked && p.status !== 'confirmado' && p.status !== 'cancelado' && (
                    <button disabled={busy === p.id} onClick={() => act(p, 'confirmado')} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" />Confirmar</button>
                  )}
                  {canOperate && !locked && (p.status === 'aguardando' || p.status === 'inscrito') && (
                    <button disabled={busy === p.id} onClick={() => act(p, 'lista_espera')} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-amber-700"><Clock className="h-3.5 w-3.5" />Lista de espera</button>
                  )}
                  {canOperate && !locked && (p.status === 'aguardando' || p.status === 'inscrito' || p.status === 'lista_espera') && (
                    <button disabled={busy === p.id} onClick={() => act(p, 'recusado')} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-red-600"><X className="h-3.5 w-3.5" />Recusar</button>
                  )}
                  {canOperate && !locked && p.status === 'confirmado' && !checkin && (
                    <button disabled={busy === p.id} onClick={() => act(p, 'cancelado')} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500"><X className="h-3.5 w-3.5" />Cancelar participação</button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
