'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, Briefcase, CheckCircle2, MapPin, User } from 'lucide-react'
import { useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { brl, fmtCompetence, fmtDate } from '@/lib/erp/ops'
import { currentCompetence, fetchFixedPost, monthlyTotal, type FixedPost } from '@/lib/erp/fixed-data'
import { fetchEventPayables } from '@/lib/erp/ops-data'
import { POST_STATUS } from '@/components/erp/FixedPostCard'
import { MembersTab } from '@/components/erp/ponto/MembersTab'
import { PeriodsTab } from '@/components/erp/ponto/PeriodsTab'
import { MembersCard } from '@/components/erp/registry-ui'
import { PayablesTable } from '@/components/erp/PayablesTable'
import { EmptyState, ErrorBox, Pill, Spinner, Tabs } from '@/components/erp/ui'

type Tab = 'resumo' | 'profissionais' | 'competencias' | 'financeiro' | 'documentos' | 'historico'

export default function PontoFixoPage() {
  const { id } = useParams<{ id: string }>()
  const search = useSearchParams()
  const s = useScope()
  const pf = useLoad(() => fetchFixedPost(id), `pf:${id}`)
  const [tab, setTab] = useState<Tab>(search.get('criado') ? 'profissionais' : 'resumo')

  if (pf.loading && !pf.data) return <Spinner />
  if (pf.error) return <ErrorBox>{pf.error}</ErrorBox>
  const p = pf.data
  if (!p) return <EmptyState title="Ponto fixo não encontrado" text="Ele pode pertencer a outra empresa ou não estar atribuído a você." action={<Link href="/pontos-fixos" className="font-bold text-amber-600">Voltar</Link>} />

  const canManage = s.canOperate && s.companyId === p.company_id
  const ativos = p.fixed_post_members.filter((m) => m.status === 'ativo').length
  const comp = currentCompetence()
  const atual = p.fixed_post_periods.find((x) => x.competence === comp)
  const st = POST_STATUS[p.status]

  return (
    <div>
      <div className="-mx-4 -mt-5 mb-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 pb-5 pt-4 text-white lg:-mx-8 lg:px-8">
        <Link href="/pontos-fixos" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Pontos Fixos</Link>
        <div className="flex gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-amber-400"><Briefcase className="h-9 w-9" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">{p.code}{s.consolidated && ` · ${s.companyName(p.company_id)}`}{p.client_name && ` · ${p.client_name}`}</div>
            <h1 className="mt-0.5 text-2xl font-black leading-tight">{p.name}</h1>
            <div className="mt-1 text-sm font-semibold text-amber-200">{[p.category, p.subcategory].filter(Boolean).join(' · ')}</div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
              {p.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-amber-400" />{p.location}</span>}
              {p.manager_name && <span className="flex items-center gap-1.5"><User className="h-4 w-4" />{p.manager_name}</span>}
            </div>
            <div className="mt-2"><Pill tone={st.tone}>{st.label}</Pill></div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([['Profissionais', ativos], ['Custo mensal', brl(monthlyTotal(p))], ['Competência', fmtCompetence(comp)], ['Situação', atual ? (atual.status === 'aberta' ? 'Em conferência' : atual.status === 'validada' ? 'Validada' : 'Enviada') : 'Não aberta']] as const).map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-white/5 px-3 py-2"><div className="truncate text-lg font-black tabular-nums">{v}</div><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{l}</div></div>
          ))}
        </div>
      </div>
      {search.get('criado') && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Ponto fixo criado. Agora aloque os profissionais e defina o valor mensal de cada um.
        </div>
      )}
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { key: 'resumo', label: 'Resumo' }, { key: 'profissionais', label: 'Profissionais' }, { key: 'competencias', label: 'Competências' },
        { key: 'financeiro', label: 'Financeiro' }, { key: 'documentos', label: 'Documentos' }, { key: 'historico', label: 'Histórico' },
      ]} />
      <div className="mt-4">
        {tab === 'resumo' && <Resumo p={p} canAssign={s.canSeeAll && canManage} />}
        {tab === 'profissionais' && <MembersTab p={p} canManage={canManage} onChanged={pf.reload} />}
        {tab === 'competencias' && <PeriodsTab p={p} canManage={canManage} onChanged={pf.reload} />}
        {tab === 'financeiro' && <Financeiro p={p} />}
        {tab === 'documentos' && <EmptyState title="Documentos" text="Contratos e anexos do posto chegam no módulo de documentos." />}
        {tab === 'historico' && <Historico p={p} />}
      </div>
    </div>
  )
}

function Resumo({ p, canAssign }: { p: FixedPost; canAssign: boolean }) {
  const row = (k: string, v: React.ReactNode) => v ? <div className="flex justify-between gap-4 py-2 text-sm"><span className="text-slate-400">{k}</span><span className="text-right font-semibold text-slate-700">{v}</span></div> : null
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="divide-y divide-slate-100 rounded-3xl border border-slate-100 bg-white px-4 py-2 shadow-sm">
        {row('Cliente', p.client_name)}
        {row('Centro de custo', p.cost_center)}
        {row('Categoria', [p.category, p.subcategory].filter(Boolean).join(' · '))}
        {row('Local', p.location)}
        {row('Endereço', p.address)}
        {row('Início', p.start_date && fmtDate(p.start_date))}
        {row('Observações', p.notes)}
      </div>
      <MembersCard operationId={p.id} companyId={p.company_id} canAssign={canAssign} />
    </div>
  )
}

function Financeiro({ p }: { p: FixedPost }) {
  const pay = useLoad(() => fetchEventPayables(p.id).catch(() => []), `pay:${p.id}:${p.fixed_post_periods.map((x) => x.status).join()}`)
  if (pay.loading) return <Spinner />
  return (pay.data ?? []).length === 0
    ? <EmptyState title="Ainda sem contas a pagar" text="São geradas quando uma competência validada é enviada ao financeiro (ou você não tem permissão financeira)." />
    : <PayablesTable rows={pay.data ?? []} />
}

function Historico({ p }: { p: FixedPost }) {
  const items: { at: string; text: string }[] = []
  for (const m of p.fixed_post_members) {
    items.push({ at: m.start_date, text: `${m.people?.full_name} alocado(a) · ${brl(m.monthly_rate)}/mês` })
    if (m.end_date) items.push({ at: m.end_date, text: `${m.people?.full_name} teve a alocação encerrada` })
  }
  for (const x of p.fixed_post_periods) {
    if (x.validated_at) items.push({ at: x.validated_at, text: `Competência ${fmtCompetence(x.competence)} validada` })
    if (x.sent_at) items.push({ at: x.sent_at, text: `Competência ${fmtCompetence(x.competence)} enviada ao financeiro` })
  }
  items.sort((a, b) => b.at.localeCompare(a.at))
  if (items.length === 0) return <EmptyState title="Sem movimentação ainda" />
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-2.5 text-sm shadow-sm">
          <span className="w-24 shrink-0 tabular-nums text-slate-400">{fmtDate(it.at)}</span><span className="text-slate-700">{it.text}</span>
        </li>
      ))}
    </ol>
  )
}
