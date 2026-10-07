'use client'
import Link from 'next/link'
import { Clock, MapPin, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { displayEventStatus, fmtTime, pct, statusTone, todayISO } from '@/lib/erp/ops'
import { eventStats, teamCounts, type EventRow } from '@/lib/erp/ops-data'
import { DateBlock, Pill, Progress } from './ui'

/** Card grande de evento: data e local em destaque, ocupação da equipe e presença. */
export function EventCard({ e, companyName, featured }: { e: EventRow; companyName?: string; featured?: boolean }) {
  const st = eventStats(e)
  const ds = displayEventStatus(e.status, e.event_date, teamCounts(e), todayISO())
  const fill = pct(st.confirmed, st.needed)
  return (
    <Link href={`/eventos/${e.id}`}
      className={cn('group block overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        featured ? 'border-amber-200' : 'border-slate-100')}>
      <div className={cn('flex gap-4 p-4', featured && 'bg-gradient-to-br from-slate-900 to-slate-800 text-white')}>
        <DateBlock date={e.event_date} size={featured ? 'lg' : 'md'} dark={featured} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className={cn('truncate text-[11px] font-bold uppercase tracking-wide', featured ? 'text-amber-300' : 'text-slate-400')}>
              {e.code}{companyName && ` · ${companyName}`}{e.client_name && ` · ${e.client_name}`}
            </div>
            <Pill tone={statusTone(ds)}>{ds}</Pill>
          </div>
          <h3 className={cn('mt-1 line-clamp-2 font-black leading-tight', featured ? 'text-xl' : 'text-lg text-slate-800')}>{e.name}</h3>
          <div className={cn('mt-2 space-y-1 text-xs', featured ? 'text-slate-300' : 'text-slate-500')}>
            {e.location && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-amber-500" /><span className="truncate">{e.location}</span></div>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {(e.start_time || e.end_time) && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{fmtTime(e.start_time)}{e.end_time && `–${fmtTime(e.end_time)}`}</span>}
              {e.manager_name && <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{e.manager_name}</span>}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-2 px-4 pb-4 pt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-bold text-slate-700"><span className="text-lg font-black tabular-nums">{st.confirmed}</span><span className="text-slate-400"> / {st.needed}</span> confirmados</span>
          <span className="text-xs font-semibold text-slate-400">{e.event_teams.length} equipe{e.event_teams.length !== 1 ? 's' : ''}</span>
        </div>
        <Progress value={fill} tone={fill >= 100 ? 'success' : 'warning'} />
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <Mini label="Presentes" value={st.present} />
          <Mini label="Vagas abertas" value={st.open} tone={st.open > 0 ? 'warning' : undefined} />
          <Mini label="Aguardando" value={st.waiting} tone={st.waiting > 0 ? 'info' : undefined} />
        </div>
      </div>
    </Link>
  )
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: 'warning' | 'info' }) {
  return (
    <div className={cn('rounded-xl py-1.5', tone === 'warning' ? 'bg-amber-50' : tone === 'info' ? 'bg-sky-50' : 'bg-slate-50')}>
      <div className={cn('text-base font-black tabular-nums', tone === 'warning' ? 'text-amber-700' : tone === 'info' ? 'text-sky-700' : 'text-slate-700')}>{value}</div>
      <div className="text-[10px] font-semibold text-slate-400">{label}</div>
    </div>
  )
}
