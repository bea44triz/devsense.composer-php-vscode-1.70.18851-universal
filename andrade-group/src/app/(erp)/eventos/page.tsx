'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarPlus, LayoutGrid, List, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { displayEventStatus, fmtDate, fmtTime, statusTone, todayISO } from '@/lib/erp/ops'
import { eventStats, fetchEvents, teamCounts, type EventRow } from '@/lib/erp/ops-data'
import { EventCard } from '@/components/erp/EventCard'
import { EmptyState, ErrorBox, Pill, Spinner } from '@/components/erp/ui'

type Filtro = 'proximos' | 'hoje' | 'fechamento' | 'todos'
const FILTROS: [Filtro, string][] = [['proximos', 'Próximos'], ['hoje', 'Hoje'], ['fechamento', 'Aguardando fechamento'], ['todos', 'Todos']]

function readView(): 'cards' | 'lista' {
  try { return localStorage.getItem('erp.eventos.view') === 'lista' ? 'lista' : 'cards' } catch { return 'cards' }
}

export default function EventosPage() {
  const s = useScope()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('proximos')
  const [view, setViewState] = useState<'cards' | 'lista'>(readView)
  const events = useLoad(() => fetchEvents(s.ids), `ev:${s.ids.join(',')}`)
  const today = todayISO()

  const setView = (v: 'cards' | 'lista') => { setViewState(v); try { localStorage.setItem('erp.eventos.view', v) } catch { /* ignora */ } }

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (events.data ?? [])
      .filter((e) => !term || `${e.code} ${e.name} ${e.client_name ?? ''} ${e.location ?? ''}`.toLowerCase().includes(term))
      .filter((e) => {
        if (filtro === 'todos') return true
        if (filtro === 'hoje') return e.event_date === today
        if (filtro === 'fechamento') return e.status === 'aguardando_fechamento' || (e.event_date < today && e.status !== 'fechado' && e.status !== 'cancelado')
        return e.event_date >= today && e.status !== 'fechado' && e.status !== 'cancelado'
      })
      .sort((a, b) => (filtro === 'todos' ? b.event_date.localeCompare(a.event_date) : a.event_date.localeCompare(b.event_date)))
  }, [events.data, q, filtro, today])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Eventos</h1>
          <p className="text-sm text-slate-400">Equipes, vagas, presença e fechamento.</p>
        </div>
        {s.canOperate && (
          <Link href="/eventos/novo" className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-200 hover:bg-amber-400">
            <CalendarPlus className="h-4 w-4" /> Novo evento
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, nome, cliente ou local"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
            {FILTROS.map(([k, l]) => (
              <button key={k} onClick={() => setFiltro(k)}
                className={cn('whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold', filtro === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>{l}</button>
            ))}
          </div>
          <div className="flex gap-1 rounded-2xl bg-slate-100 p-1" role="group" aria-label="Visualização">
            <button onClick={() => setView('cards')} aria-label="Cards" className={cn('rounded-xl p-2', view === 'cards' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400')}><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setView('lista')} aria-label="Lista" className={cn('rounded-xl p-2', view === 'lista' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400')}><List className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {events.error && <ErrorBox>{events.error}</ErrorBox>}
      {events.loading ? <Spinner /> : list.length === 0 ? (
        <EmptyState title="Nenhum evento encontrado" text={s.canOperate ? 'Crie o primeiro evento em “Novo evento”.' : undefined} />
      ) : view === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => <EventCard key={e.id} e={e} companyName={s.consolidated ? s.companyName(e.company_id) : undefined} />)}
        </div>
      ) : (
        <ListaEventos list={list} today={today} companyName={s.consolidated ? s.companyName : undefined} />
      )}
    </div>
  )
}

function ListaEventos({ list, today, companyName }: { list: EventRow[]; today: string; companyName?: (id: string) => string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Data</th><th className="px-4 py-3">Evento</th><th className="px-4 py-3">Local</th>
              <th className="px-4 py-3">Responsável</th><th className="px-4 py-3 text-right">Necess.</th><th className="px-4 py-3 text-right">Confirm.</th>
              <th className="px-4 py-3 text-right">Presentes</th><th className="px-4 py-3 text-right">Vagas</th><th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((e) => {
              const st = eventStats(e)
              const ds = displayEventStatus(e.status, e.event_date, teamCounts(e), today)
              return (
                <tr key={e.id} className="hover:bg-amber-50/40">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{fmtDate(e.event_date)} <span className="text-slate-400">{fmtTime(e.start_time)}</span></td>
                  <td className="px-4 py-3">
                    <Link href={`/eventos/${e.id}`} className="font-bold text-slate-800 hover:text-amber-700">{e.name}</Link>
                    <div className="text-xs text-slate-400">{e.code}{companyName && ` · ${companyName(e.company_id)}`}{e.client_name && ` · ${e.client_name}`}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{e.location ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{e.manager_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{st.needed}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{st.confirmed}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{st.present}</td>
                  <td className={cn('px-4 py-3 text-right font-bold tabular-nums', st.open > 0 ? 'text-amber-600' : 'text-slate-400')}>{st.open}</td>
                  <td className="px-4 py-3"><Pill tone={statusTone(ds)}>{ds}</Pill></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
