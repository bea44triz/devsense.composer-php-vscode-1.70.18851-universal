'use client'
import Link from 'next/link'
import { Briefcase, MapPin, User, Users } from 'lucide-react'
import { brl, fmtCompetence } from '@/lib/erp/ops'
import { currentCompetence, monthlyTotal, type FixedPost } from '@/lib/erp/fixed-data'
import { Pill, type Tone } from './ui'

const PERIOD: Record<string, { label: string; tone: Tone }> = {
  aberta: { label: 'Em conferência', tone: 'info' }, validada: { label: 'Validada', tone: 'warning' }, enviada: { label: 'Enviada ao financeiro', tone: 'success' },
}
export const POST_STATUS: Record<FixedPost['status'], { label: string; tone: Tone }> = {
  ativo: { label: 'Ativo', tone: 'success' }, suspenso: { label: 'Suspenso', tone: 'warning' }, encerrado: { label: 'Encerrado', tone: 'muted' },
}

/** Mesmo idioma visual dos eventos: cartão grande, local e responsável em destaque, custo e competência. */
export function FixedPostCard({ p, companyName }: { p: FixedPost; companyName?: string }) {
  const ativos = p.fixed_post_members.filter((m) => m.status === 'ativo').length
  const comp = currentCompetence()
  const period = p.fixed_post_periods.find((x) => x.competence === comp)
  const st = POST_STATUS[p.status]
  return (
    <Link href={`/pontos-fixos/${p.id}`} className="group block overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex gap-4 p-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-amber-400"><Briefcase className="h-7 w-7" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-400">{p.code}{companyName && ` · ${companyName}`}{p.client_name && ` · ${p.client_name}`}</div>
            <Pill tone={st.tone}>{st.label}</Pill>
          </div>
          <h3 className="mt-1 line-clamp-2 text-lg font-black leading-tight text-slate-800">{p.name}</h3>
          <div className="mt-1 text-xs font-semibold text-amber-700">{[p.category, p.subcategory].filter(Boolean).join(' · ') || 'Sem categoria'}</div>
          <div className="mt-2 space-y-1 text-xs text-slate-500">
            {p.location && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-amber-500" /><span className="truncate">{p.location}</span></div>}
            {p.manager_name && <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{p.manager_name}</div>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 pb-4 text-center">
        <div className="rounded-xl bg-slate-50 py-1.5"><div className="flex items-center justify-center gap-1 text-base font-black text-slate-700"><Users className="h-3.5 w-3.5 text-amber-500" />{ativos}</div><div className="text-[10px] font-semibold text-slate-400">Profissionais</div></div>
        <div className="rounded-xl bg-slate-50 py-1.5"><div className="text-base font-black tabular-nums text-slate-700">{brl(monthlyTotal(p))}</div><div className="text-[10px] font-semibold text-slate-400">Custo mensal</div></div>
        <div className="rounded-xl bg-slate-50 py-1.5">
          <div className="truncate px-1 text-xs font-black text-slate-700">{fmtCompetence(comp)}</div>
          <div className="text-[10px] font-semibold text-slate-400">{period ? PERIOD[period.status]?.label : 'Não aberta'}</div>
        </div>
      </div>
    </Link>
  )
}
