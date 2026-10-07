import type { ReactNode } from 'react'
import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { dateParts, fmtDate, fmtTime } from '@/lib/erp/ops'

/** Moldura das páginas públicas (inscrição e presença) no visual do app Andrade. */
export function PublicShell({ company, badge, title, date, start, end, location, address, children }: {
  company?: string; badge?: string; title?: string; date?: string; start?: string | null; end?: string | null
  location?: string | null; address?: string | null; children: ReactNode
}) {
  const dp = date ? dateParts(date) : null
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="relative overflow-hidden bg-slate-900 px-5 pb-6 pt-10 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="relative mx-auto max-w-lg">
          {company && (
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-sm font-black">{company.slice(0, 1)}</div>
              <div className="text-sm font-bold text-slate-200">{company}</div>
            </div>
          )}
          {badge && <div className="mb-2 inline-flex rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-300">{badge}</div>}
          {title && (
            <div className="flex gap-4">
              {dp && (
                <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/10 leading-none">
                  <span className="text-2xl font-black">{dp.day}</span><span className="mt-1 text-[11px] font-bold tracking-widest">{dp.month}</span>
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-black leading-tight">{title}</h1>
                <div className="mt-1.5 space-y-0.5 text-sm text-slate-300">
                  {date && <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{fmtDate(date)}{(start || end) && <><Clock className="ml-2 h-3.5 w-3.5" />{fmtTime(start)}{end && ` às ${fmtTime(end)}`}</>}</div>}
                  {location && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-amber-400" />{location}</div>}
                  {address && <div className="pl-5 text-xs text-slate-400">{address}</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-lg space-y-4 px-4 py-5">{children}</main>
    </div>
  )
}

export function PublicCard({ children }: { children: ReactNode }) {
  return <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">{children}</div>
}
