'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Eye } from 'lucide-react'
import { formatPhone } from '@/lib/utils'
import { useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { brl, fmtDate, maskCpf, PARTICIPANT_LABEL, type ParticipantStatus } from '@/lib/erp/ops'
import { fetchPerson, personPayables, personPix } from '@/lib/erp/people-data'
import type { PayableRow } from '@/lib/erp/ops-data'
import { PayablesTable } from '@/components/erp/PayablesTable'
import { EmptyState, ErrorBox, Pill, Spinner, Tabs } from '@/components/erp/ui'

type Tab = 'dados' | 'eventos' | 'pontos' | 'presenca' | 'financeiro' | 'documentos'
const PIX: Record<string, string> = { cpf: 'CPF', cnpj: 'CNPJ', celular: 'Celular', email: 'E-mail', aleatoria: 'Aleatória' }

export default function PessoaPage() {
  const { id } = useParams<{ id: string }>()
  const s = useScope()
  const person = useLoad(() => fetchPerson(id), `person:${id}`)
  const [tab, setTab] = useState<Tab>('dados')
  const [pix, setPix] = useState<string | null>(null)

  if (person.loading && !person.data) return <Spinner />
  if (person.error) return <ErrorBox>{person.error}</ErrorBox>
  const p = person.data
  if (!p) return <EmptyState title="Profissional não encontrado" text="Você só vê profissionais das operações que acompanha." action={<Link href="/pessoas" className="font-bold text-amber-600">Voltar</Link>} />

  const roles = new Set([p.main_role, ...p.event_participants.map((e) => e.event_teams?.name), ...p.fixed_post_members.map((m) => m.role)].filter(Boolean) as string[])
  const presencas = p.event_participants.flatMap((ep) => ep.attendance.map((a) => ({ ...a, evento: ep.events?.name ?? '' }))).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
  const reveal = async () => setPix((await personPix(p.id))?.pix_key ?? null)

  return (
    <div>
      <div className="-mx-4 -mt-5 mb-5 bg-gradient-to-br from-slate-900 to-slate-800 px-4 pb-5 pt-4 text-white lg:-mx-8 lg:px-8">
        <Link href="/pessoas" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Pessoas</Link>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xl font-black">{p.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
          <div>
            <h1 className="text-2xl font-black">{p.full_name}</h1>
            <div className="mt-1 flex flex-wrap gap-1">{[...roles].slice(0, 4).map((r) => <span key={r} className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-amber-200">{r}</span>)}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/5 px-3 py-2"><div className="text-lg font-black">{p.event_participants.filter((e) => e.status === 'confirmado').length}</div><div className="text-[10px] font-semibold uppercase text-slate-400">Eventos</div></div>
          <div className="rounded-2xl bg-white/5 px-3 py-2"><div className="text-lg font-black">{p.fixed_post_members.filter((m) => m.status === 'ativo').length}</div><div className="text-[10px] font-semibold uppercase text-slate-400">Pontos ativos</div></div>
          <div className="rounded-2xl bg-white/5 px-3 py-2"><div className="text-lg font-black">{new Set(presencas.filter((a) => a.kind === 'checkin').map((a) => a.work_date)).size}</div><div className="text-[10px] font-semibold uppercase text-slate-400">Dias trabalhados</div></div>
        </div>
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { key: 'dados', label: 'Dados' }, { key: 'eventos', label: 'Eventos' }, { key: 'pontos', label: 'Pontos Fixos' },
        { key: 'presenca', label: 'Presença' }, { key: 'financeiro', label: 'Financeiro' }, { key: 'documentos', label: 'Documentos' },
      ]} />
      <div className="mt-4">
        {tab === 'dados' && (
          <div className="divide-y divide-slate-100 rounded-3xl border border-slate-100 bg-white px-4 py-2 shadow-sm">
            {([['CPF', maskCpf(p.cpf)], ['Celular', p.phone ? formatPhone(p.phone) : '—'], ['E-mail', p.email ?? '—'], ['Status', p.status]] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5 text-sm"><span className="text-slate-400">{k}</span><span className="font-semibold text-slate-700">{v}</span></div>
            ))}
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-slate-400">PIX</span>
              <span className="flex items-center gap-2 font-semibold text-slate-700">
                {p.has_pix ? <>{PIX[p.pix_type ?? ''] ?? p.pix_type} · <span className="font-mono">{pix ?? p.pix_key_masked}</span></> : <span className="text-red-600">não cadastrado</span>}
                {p.has_pix && !pix && s.canSeeFinanceData && <button onClick={reveal} className="inline-flex items-center gap-1 text-xs font-bold text-amber-600"><Eye className="h-3.5 w-3.5" />mostrar</button>}
              </span>
            </div>
            {p.pix_updated_publicly_at && <div className="py-2.5 text-xs font-semibold text-amber-700">PIX alterado pelo link público em {fmtDate(p.pix_updated_publicly_at)} — o financeiro confere antes de pagar.</div>}
          </div>
        )}
        {tab === 'eventos' && (p.event_participants.length === 0 ? <EmptyState title="Sem participação em eventos" /> : (
          <ul className="space-y-2">{p.event_participants.map((ep) => (
            <li key={ep.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm shadow-sm">
              <div className="min-w-0 flex-1">
                {ep.events ? <Link href={`/eventos/${ep.events.id}`} className="font-bold text-slate-800 hover:text-amber-700">{ep.events.name}</Link> : '—'}
                <div className="text-xs text-slate-400">{ep.events && fmtDate(ep.events.event_date)} · {ep.event_teams?.name}</div>
              </div>
              <Pill tone={ep.status === 'confirmado' ? 'success' : 'muted'}>{PARTICIPANT_LABEL[ep.status as ParticipantStatus] ?? ep.status}</Pill>
              {ep.worked && <span className="font-bold tabular-nums">{brl(ep.final_amount)}</span>}
            </li>
          ))}</ul>
        ))}
        {tab === 'pontos' && (p.fixed_post_members.length === 0 ? <EmptyState title="Sem alocação em pontos fixos" /> : (
          <ul className="space-y-2">{p.fixed_post_members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm shadow-sm">
              <div className="min-w-0 flex-1">
                {m.fixed_posts ? <Link href={`/pontos-fixos/${m.fixed_posts.id}`} className="font-bold text-slate-800 hover:text-amber-700">{m.fixed_posts.name}</Link> : '—'}
                <div className="text-xs text-slate-400">{m.role} · desde {fmtDate(m.start_date)}{m.end_date && ` até ${fmtDate(m.end_date)}`}</div>
              </div>
              <Pill tone={m.status === 'ativo' ? 'success' : 'muted'}>{m.status === 'ativo' ? 'Ativo' : 'Encerrado'}</Pill>
              <span className="font-bold tabular-nums">{brl(m.monthly_rate)}/mês</span>
            </li>
          ))}</ul>
        ))}
        {tab === 'presenca' && (presencas.length === 0 ? <EmptyState title="Sem registros de presença" /> : (
          <ul className="space-y-2">{presencas.map((a, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-2.5 text-sm shadow-sm">
              <span className="w-24 shrink-0 tabular-nums text-slate-400">{fmtDate(a.work_date)}</span>
              <span className="flex-1 font-semibold text-slate-700">{a.kind === 'checkin' ? 'Entrada' : 'Saída'} · {a.evento}</span>
              <span className="tabular-nums">{new Date(a.recorded_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              {a.inside_radius === false && <Pill tone="danger">fora do raio</Pill>}
            </li>
          ))}</ul>
        ))}
        {tab === 'financeiro' && <Financeiro id={p.id} />}
        {tab === 'documentos' && <EmptyState title="Documentos" text="Documentos do profissional chegam no módulo de documentos." />}
      </div>
    </div>
  )
}

function Financeiro({ id }: { id: string }) {
  const pay = useLoad(() => personPayables(id).catch(() => []), `ppay:${id}`)
  if (pay.loading) return <Spinner />
  return (pay.data ?? []).length === 0
    ? <EmptyState title="Sem lançamentos visíveis" text="Lançamentos aparecem após o fechamento de eventos ou competências (e exigem permissão financeira)." />
    : <PayablesTable rows={(pay.data ?? []) as PayableRow[]} />
}
