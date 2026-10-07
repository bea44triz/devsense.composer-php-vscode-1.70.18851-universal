'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { CheckCircle2, ClipboardCheck, ExternalLink, Loader2, MapPin, Pencil } from 'lucide-react'
import { useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { brl, fmtDateRange, fmtTime, todayISO } from '@/lib/erp/ops'
import { eventStats, fetchEvent, fetchEventPayables, finishEvent, updateEventRefs, type EventRow } from '@/lib/erp/ops-data'
import { EventHeader } from '@/components/erp/evento/EventHeader'
import { TeamsTab } from '@/components/erp/evento/TeamsTab'
import { ProfessionalsTab } from '@/components/erp/evento/ProfessionalsTab'
import { PresenceTab } from '@/components/erp/evento/PresenceTab'
import { EmptyState, ErrorBox, LinkActions, Modal, Spinner, Tabs } from '@/components/erp/ui'
import { CentroSelect, ClienteSelect, F, MembersCard, field } from '@/components/erp/registry-ui'
import { PayablesTable } from '@/components/erp/PayablesTable'

type Tab = 'geral' | 'equipes' | 'profissionais' | 'presenca' | 'fornecedores' | 'financeiro' | 'documentos' | 'historico'

export default function EventoPage() {
  const { id } = useParams<{ id: string }>()
  const search = useSearchParams()
  const s = useScope()
  const ev = useLoad(() => fetchEvent(id), `ev:${id}`)
  const [tab, setTab] = useState<Tab>(search.get('criado') ? 'equipes' : 'geral')
  const [teamFilter, setTeamFilter] = useState<string | null>(null)

  if (ev.loading && !ev.data) return <Spinner />
  if (ev.error) return <ErrorBox>{ev.error}</ErrorBox>
  const e = ev.data
  if (!e) return <EmptyState title="Evento não encontrado" text="Ele pode pertencer a outra empresa ou não existir." action={<Link href="/eventos" className="font-bold text-amber-600">Voltar para eventos</Link>} />

  // edição só na empresa dona do evento (no consolidado tudo é consulta)
  const canOperate = s.canOperate && s.companyId === e.company_id
  const st = eventStats(e)

  return (
    <div>
      <EventHeader e={e} companyName={s.consolidated ? s.companyName(e.company_id) : undefined} />
      {search.get('criado') && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Evento criado. Os links de inscrição de cada equipe e os links de presença já estão prontos para enviar.</span>
        </div>
      )}
      <StatusBanner e={e} canOperate={canOperate} onChanged={ev.reload} />

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { key: 'geral', label: 'Visão Geral' },
        { key: 'equipes', label: 'Equipes' },
        { key: 'profissionais', label: 'Profissionais', badge: st.waiting },
        { key: 'presenca', label: 'Presença' },
        { key: 'fornecedores', label: 'Fornecedores' },
        { key: 'financeiro', label: 'Financeiro' },
        { key: 'documentos', label: 'Documentos' },
        { key: 'historico', label: 'Histórico' },
      ]} />

      <div className="mt-4">
        {tab === 'geral' && <Overview e={e} canOperate={canOperate} canAssign={canOperate && s.canSeeAll} canRegistry={s.canRegistry} onChanged={ev.reload} />}
        {tab === 'equipes' && <TeamsTab e={e} canOperate={canOperate} onChanged={ev.reload} onViewTeam={(t) => { setTeamFilter(t); setTab('profissionais') }} />}
        {tab === 'profissionais' && <ProfessionalsTab e={e} canOperate={canOperate} teamFilter={teamFilter} setTeamFilter={setTeamFilter} onChanged={ev.reload} />}
        {tab === 'presenca' && <PresenceTab e={e} canOperate={canOperate} onChanged={ev.reload} />}
        {tab === 'fornecedores' && <EmptyState title="Fornecedores do evento" text="Chega no Marco 4: contratação de fornecedores e lançamentos com origem fornecedor." />}
        {tab === 'financeiro' && <FinanceTab e={e} />}
        {tab === 'documentos' && <EmptyState title="Documentos" text="Chega no Marco 4: arquivos privados do evento (contratos, notas, comprovantes)." />}
        {tab === 'historico' && <History e={e} />}
      </div>
    </div>
  )
}

function StatusBanner({ e, canOperate, onChanged }: { e: EventRow; canOperate: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const today = todayISO()
  const running = ['planejamento', 'inscricoes_abertas', 'em_andamento'].includes(e.status)
  if (e.status === 'aguardando_fechamento') {
    return (
      <Link href={`/eventos/${e.id}/fechamento`} className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
        <ClipboardCheck className="h-5 w-5 shrink-0 text-amber-600" />
        <span className="flex-1">Evento encerrado — aguardando fechamento. Valide os profissionais e envie ao financeiro.</span>
        <span className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white">Fazer fechamento</span>
      </Link>
    )
  }
  if (e.status === 'fechado') {
    return <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Fechamento enviado ao financeiro. As contas a pagar estão na aba Financeiro.</div>
  }
  if (!running || !canOperate || e.event_date > today) return null
  const finish = async () => {
    if (!confirm('Encerrar o evento? O check-in/check-out será fechado e começa o fechamento operacional.')) return
    setBusy(true); setErr(null)
    try { await finishEvent(e.id); onChanged() } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1 text-slate-600">{e.event_date < today ? 'A data do evento já passou.' : 'Evento acontecendo hoje.'} Quando terminar, encerre para iniciar o fechamento.</span>
        <button onClick={finish} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Encerrar evento
        </button>
      </div>
      {err && <p className="mt-2 text-red-600">{err}</p>}
    </div>
  )
}

function Overview({ e, canOperate, canAssign, canRegistry, onChanged }: { e: EventRow; canOperate: boolean; canAssign: boolean; canRegistry: boolean; onChanged: () => void }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const st = eventStats(e)
  const [editing, setEditing] = useState(false)
  const editable = canOperate && e.status !== 'fechado' && e.status !== 'cancelado'
  const row = (k: string, v: React.ReactNode) => v ? <div className="flex justify-between gap-4 py-2 text-sm"><span className="text-slate-400">{k}</span><span className="text-right font-semibold text-slate-700">{v}</span></div> : null
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="divide-y divide-slate-100 rounded-3xl border border-slate-100 bg-white px-4 py-2 shadow-sm">
        {editable && (
          <div className="flex justify-end py-2"><button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-bold text-amber-600"><Pencil className="h-3.5 w-3.5" />Cliente, centro de custo e data final</button></div>
        )}
        {row('Data', `${fmtDateRange(e.event_date, e.end_date)} ${fmtTime(e.start_time)}${e.end_time ? ` às ${fmtTime(e.end_time)}` : ''}`)}
        {row('Cliente', e.client_name)}
        {row('Centro de custo', e.cost_center)}
        {row('Responsável', e.manager_name)}
        {row('Local', e.location)}
        {row('Endereço', e.address)}
        {e.latitude != null && row('Localização', (
          <a className="inline-flex items-center gap-1 text-amber-600" href={`https://maps.google.com/?q=${e.latitude},${e.longitude}`} target="_blank" rel="noreferrer">
            <MapPin className="h-3.5 w-3.5" />Ver no mapa (raio {e.radius_m} m)<ExternalLink className="h-3 w-3" />
          </a>
        ))}
        {row('Observações', e.notes)}
      </div>
      <div className="space-y-4">
        <MembersCard operationId={e.id} companyId={e.company_id} canAssign={canAssign} />
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Links de presença</div>
          <div className="space-y-3">
            <div><div className="mb-1 text-sm font-bold text-slate-700">Check-in</div><LinkActions url={`${origin}/p/${e.checkin_token}`} title={`Check-in · ${e.name}`} /></div>
            <div><div className="mb-1 text-sm font-bold text-slate-700">Check-out</div><LinkActions url={`${origin}/p/${e.checkout_token}`} title={`Check-out · ${e.name}`} /></div>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-4 text-sm shadow-sm">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Situação</div>
          <div className="flex justify-between py-1"><span className="text-slate-500">Aguardando confirmação</span><b>{st.waiting}</b></div>
          <div className="flex justify-between py-1"><span className="text-slate-500">Confirmados sem check-in</span><b>{st.noShow}</b></div>
          <div className="flex justify-between py-1"><span className="text-slate-500">Check-out pendente</span><b>{st.checkoutPending}</b></div>
          <div className="flex justify-between py-1"><span className="text-slate-500">Equipes incompletas</span><b>{st.incompleteTeams}</b></div>
          <div className="flex justify-between py-1"><span className="text-slate-500">Custo previsto</span><b>{brl(st.plannedCost)}</b></div>
        </div>
      </div>
      {editing && <EditRefs e={e} canRegistry={canRegistry} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged() }} />}
    </div>
  )
}

function EditRefs({ e, canRegistry, onClose, onSaved }: { e: EventRow; canRegistry: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ cliente: e.cliente_evento_id ?? '', cc: e.centro_custo_id ?? '', end: e.end_date ?? e.event_date })
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (f.end < e.event_date) return setErr('A data final não pode ser anterior à data inicial.')
    try { await updateEventRefs(e.id, f.cliente || null, f.cc || null, f.end); onSaved() } catch (x) { setErr((x as Error).message) }
  }
  return (
    <Modal open onClose={onClose} title="Dados do evento">
      <div className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <ClienteSelect companyId={e.company_id} value={f.cliente} onChange={(v) => setF({ ...f, cliente: v })} canCreate={canRegistry} />
        <CentroSelect companyId={e.company_id} value={f.cc} onChange={(v) => setF({ ...f, cc: v })} canCreate={canRegistry} />
        <F label="Data final"><input type="date" className={field} min={e.event_date} value={f.end} onChange={(ev) => setF({ ...f, end: ev.target.value })} /></F>
        <button onClick={save} className="w-full rounded-2xl bg-amber-500 py-3 font-bold text-white">Salvar</button>
      </div>
    </Modal>
  )
}

function FinanceTab({ e }: { e: EventRow }) {
  const pay = useLoad(() => fetchEventPayables(e.id).catch(() => []), `pay:${e.id}:${e.status}`)
  const st = eventStats(e)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"><div className="text-[11px] font-semibold uppercase text-slate-400">Previsto</div><div className="text-xl font-black">{brl(st.plannedCost)}</div></div>
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"><div className="text-[11px] font-semibold uppercase text-slate-400">Validado</div><div className="text-xl font-black">{brl(st.validatedCost)}</div></div>
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"><div className="text-[11px] font-semibold uppercase text-slate-400">Lançado</div><div className="text-xl font-black">{brl((pay.data ?? []).reduce((a, p) => a + Number(p.amount), 0))}</div></div>
      </div>
      {e.status !== 'fechado'
        ? <EmptyState title="Ainda sem contas a pagar" text="As contas a pagar são geradas automaticamente quando o fechamento do evento é enviado ao financeiro." />
        : pay.loading ? <Spinner /> : (pay.data ?? []).length === 0
          ? <EmptyState title="Sem lançamentos visíveis" text="Seu usuário pode não ter permissão de ver o financeiro desta empresa." />
          : <PayablesTable rows={pay.data ?? []} />}
    </div>
  )
}

function History({ e }: { e: EventRow }) {
  type Item = { at: string; text: string }
  const items: Item[] = []
  for (const p of e.event_participants) {
    const n = p.people?.full_name ?? ''
    items.push({ at: p.created_at, text: `${n} se inscreveu` })
    for (const a of p.attendance) items.push({ at: a.recorded_at, text: `${n} fez ${a.kind === 'checkin' ? 'check-in' : 'check-out'}${a.inside_radius === false ? ' (fora do raio)' : ''}` })
  }
  items.sort((a, b) => b.at.localeCompare(a.at))
  if (items.length === 0) return <EmptyState title="Sem movimentação ainda" />
  return (
    <ol className="space-y-2">
      {items.slice(0, 200).map((it, i) => (
        <li key={i} className="flex gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-2.5 text-sm shadow-sm">
          <span className="w-28 shrink-0 tabular-nums text-slate-400">{new Date(it.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          <span className="text-slate-700">{it.text}</span>
        </li>
      ))}
    </ol>
  )
}
