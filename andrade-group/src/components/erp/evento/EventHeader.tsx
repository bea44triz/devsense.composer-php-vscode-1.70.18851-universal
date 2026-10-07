'use client'
import Link from 'next/link'
import { ArrowLeft, Clock, MapPin } from 'lucide-react'
import { brl, displayEventStatus, fmtTime, statusTone, todayISO } from '@/lib/erp/ops'
import { eventStats, teamCounts, type EventRow } from '@/lib/erp/ops-data'
import { DateBlock, Pill } from '../ui'

export function EventHeader({ e, companyName }: { e: EventRow; companyName?: string }) {
  const st = eventStats(e)
  const ds = displayEventStatus(e.status, e.event_date, teamCounts(e), todayISO())
  const kpis: [string, string | number, string?][] = [
    ['Necessários', st.needed],
    ['Confirmados', st.confirmed],
    ['Presentes', st.present],
    ['Vagas', st.open, st.open > 0 ? 'text-amber-400' : undefined],
    ['Previsto', brl(st.plannedCost)],
    ['Validado', brl(st.validatedCost)],
  ]
  return (
    <div className="-mx-4 -mt-5 mb-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 pb-5 pt-4 text-white lg:-mx-8 lg:px-8">
      <Link href="/eventos" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Eventos</Link>
      <div className="flex gap-4">
        <DateBlock date={e.event_date} size="lg" dark />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
            {e.code}{companyName && ` · ${companyName}`}{e.client_name && ` · ${e.client_name}`}
          </div>
          <h1 className="mt-0.5 text-2xl font-black leading-tight">{e.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300">
            {e.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-amber-400" />{e.location}</span>}
            {(e.start_time || e.end_time) && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{fmtTime(e.start_time)}{e.end_time && ` às ${fmtTime(e.end_time)}`}</span>}
          </div>
          <div className="mt-2"><Pill tone={statusTone(ds)}>{ds}</Pill></div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {kpis.map(([l, v, cls]) => (
          <div key={l} className="rounded-2xl bg-white/5 px-3 py-2">
            <div className={`text-lg font-black tabular-nums ${cls ?? ''}`}>{v}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
