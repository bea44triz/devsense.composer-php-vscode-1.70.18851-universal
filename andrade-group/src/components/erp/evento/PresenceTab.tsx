'use client'
import { useState } from 'react'
import { Camera, CheckCircle2, LogIn, LogOut, MapPin, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { presencePhotoUrl, rotateLink, teamStats, type AttRow, type EventRow } from '@/lib/erp/ops-data'
import { eventDays, todayISO } from '@/lib/erp/ops'
import { EmptyState, ErrorBox, LinkActions, Modal } from '../ui'

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Painel do coordenador: em poucos segundos, quem chegou, quem falta e onde há vagas. */
export function PresenceTab({ e, canOperate, onChanged }: { e: EventRow; canOperate?: boolean; onChanged?: () => void }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null)
  const days = eventDays(e.event_date, e.end_date)
  const today = todayISO()
  const [day, setDay] = useState(days.includes(today) ? today : days[0] ?? e.event_date)
  const [err, setErr] = useState<string | null>(null)
  const multi = days.length > 1
  const rotate = async (kind: 'checkin' | 'checkout') => {
    if (!confirm('Gerar um link novo? O link atual deixa de funcionar imediatamente.')) return
    setErr(null)
    try { await rotateLink(kind, e.id); onChanged?.() } catch (x) { setErr((x as Error).message) }
  }
  const teamName = (id: string) => e.event_teams.find((t) => t.id === id)?.name ?? ''
  const confirmed = e.event_participants.filter((p) => p.status === 'confirmado')

  const openPhoto = async (a: AttRow, name: string) => {
    if (!a.photo_path) return
    const url = await presencePhotoUrl(a.photo_path)
    if (url) setPhoto({ url, name })
  }

  return (
    <div className="space-y-5">
      {err && <ErrorBox>{err}</ErrorBox>}
      {multi && (
        <div className="flex gap-1.5 overflow-x-auto">
          {days.map((d) => (
            <button key={d} onClick={() => setDay(d)} className={`whitespace-nowrap rounded-2xl border px-3 py-2 text-sm font-bold ${d === day ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-500'}`}>
              {d.slice(8, 10)}/{d.slice(5, 7)}{d === today && ' · hoje'}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {teamStats(e, day).map(({ team, needed, confirmed: conf, present, arrivedMissing, open }) => {
          const complete = open === 0 && arrivedMissing === 0 && present === needed
          return (
            <div key={team.id} className={cn('rounded-3xl border bg-white p-4 shadow-sm', complete ? 'border-emerald-200' : 'border-slate-100')}>
              <div className="flex items-center justify-between">
                <div className="text-lg font-black uppercase tracking-wide text-slate-800">{team.name}</div>
                {complete && <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 className="h-4 w-4" />Equipe completa</span>}
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                <li className="flex justify-between"><span className="text-slate-500">Necessários</span><b className="tabular-nums">{needed}</b></li>
                <li className="flex justify-between"><span className="text-slate-500">Confirmados</span><b className="tabular-nums">{conf}</b></li>
                <li className="flex justify-between"><span className="text-slate-500">Presentes</span><b className="tabular-nums text-emerald-700">{present}</b></li>
                {arrivedMissing > 0 && <li className="flex justify-between font-semibold text-amber-700"><span>Confirmados que ainda não chegaram</span><b className="tabular-nums">{arrivedMissing}</b></li>}
                {open > 0 && <li className="flex justify-between font-semibold text-red-600"><span>Vagas abertas</span><b className="tabular-nums">{open}</b></li>}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="grid gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:grid-cols-2">
        <div><div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><LogIn className="h-3.5 w-3.5" />Link de check-in</div>
          <LinkActions url={`${origin}/p/${e.checkin_token}`} title={`Check-in · ${e.name}`} />
          {canOperate && <button onClick={() => rotate('checkin')} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-amber-600"><RefreshCw className="h-3 w-3" />Gerar novo link</button>}</div>
        <div><div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><LogOut className="h-3.5 w-3.5" />Link de check-out</div>
          <LinkActions url={`${origin}/p/${e.checkout_token}`} title={`Check-out · ${e.name}`} />
          {canOperate && <button onClick={() => rotate('checkout')} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-amber-600"><RefreshCw className="h-3 w-3" />Gerar novo link</button>}</div>
      </div>

      {confirmed.length === 0 ? <EmptyState title="Nenhum profissional confirmado" /> : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          {confirmed.map((p) => {
            const cin = p.attendance.find((a) => a.kind === 'checkin' && a.work_date === day)
            const cout = p.attendance.find((a) => a.kind === 'checkout' && a.work_date === day)
            const name = p.people?.full_name ?? ''
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', cout ? 'bg-slate-400' : cin ? 'bg-emerald-500' : 'bg-amber-400')} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-slate-800">{name}</div>
                  <div className="text-xs text-slate-400">{teamName(p.team_id)}</div>
                </div>
                <Mark a={cin} label="Entrada" onPhoto={() => cin && openPhoto(cin, name)} />
                <Mark a={cout} label="Saída" onPhoto={() => cout && openPhoto(cout, name)} />
              </li>
            )
          })}
        </ul>
      )}
      <Modal open={!!photo} onClose={() => setPhoto(null)} title={photo?.name ?? ''}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo.url} alt={`Foto de ${photo.name}`} className="mx-auto max-h-[60vh] rounded-2xl" />}
      </Modal>
    </div>
  )
}

function Mark({ a, label, onPhoto }: { a?: AttRow; label: string; onPhoto: () => void }) {
  if (!a) return <div className="w-24 text-right text-xs text-slate-300">{label} —</div>
  return (
    <div className="w-24 text-right">
      <div className="text-sm font-black tabular-nums text-slate-800">{hhmm(a.recorded_at)}</div>
      <div className="flex items-center justify-end gap-1.5 text-[10px] font-semibold">
        {a.inside_radius === false
          ? <span className="flex items-center gap-0.5 text-red-600"><MapPin className="h-3 w-3" />fora do raio</span>
          : a.inside_radius ? <span className="text-emerald-600">no local</span> : <span className="text-slate-400">{label}</span>}
        {a.photo_path && <button onClick={onPhoto} aria-label={`Foto ${label}`} className="text-slate-400 hover:text-amber-600"><Camera className="h-3.5 w-3.5" /></button>}
      </div>
    </div>
  )
}
