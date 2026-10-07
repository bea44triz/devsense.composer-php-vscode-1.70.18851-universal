'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Loader2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { brl, fmtDate, participantFinal } from '@/lib/erp/ops'
import { fetchEvent, finishEvent, sendEventToFinance, updateParticipantClosing, type EventRow, type PartRow } from '@/lib/erp/ops-data'
import { EmptyState, ErrorBox, Pill, Spinner } from '@/components/erp/ui'

interface Draft { worked: boolean | null; days: string; addition: string; discount: string; notes: string }
const toDraft = (p: PartRow): Draft => ({
  worked: p.worked, days: String(p.days ?? 1), addition: String(p.addition ?? 0), discount: String(p.discount ?? 0), notes: p.validation_notes ?? '',
})
const num = (v: string) => Number(String(v).replace(',', '.')) || 0
const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—')

export default function FechamentoPage() {
  const { id } = useParams<{ id: string }>()
  const s = useScope()
  const ev = useLoad(() => fetchEvent(id), `fech:${id}`)
  if (ev.loading && !ev.data) return <Spinner />
  if (ev.error) return <ErrorBox>{ev.error}</ErrorBox>
  if (!ev.data) return <EmptyState title="Evento não encontrado" />
  // a key reinicia os rascunhos só quando o status muda (encerrado → fechado), não a cada recarga
  return <Fechamento key={`${ev.data.id}:${ev.data.status}`} e={ev.data} canOperate={s.canOperate && s.companyId === ev.data.company_id} reload={ev.reload} />
}

function Fechamento({ e, canOperate, reload }: { e: EventRow; canOperate: boolean; reload: () => void }) {
  const confirmed = useMemo(() => e.event_participants.filter((p) => p.status === 'confirmado'), [e])
  // base = último valor salvo no banco; drafts = o que está na tela
  const [base, setBase] = useState<Record<string, Draft>>(() => Object.fromEntries(confirmed.map((p) => [p.id, toDraft(p)])))
  const [drafts, setDrafts] = useState<Record<string, Draft>>(base)
  const [saving, setSaving] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState<number | null>(null)

  const teamName = (id: string) => e.event_teams.find((t) => t.id === id)?.name ?? ''
  const editable = canOperate && e.status === 'aguardando_fechamento'
  const dirty = (p: PartRow) => JSON.stringify(drafts[p.id] ?? null) !== JSON.stringify(base[p.id] ?? null)
  const finalOf = (p: PartRow) => {
    const d = drafts[p.id] ?? toDraft(p)
    return participantFinal({ worked: d.worked, days: num(d.days), rate: Number(p.rate), addition: num(d.addition), discount: num(d.discount) })
  }
  const total = confirmed.reduce((a, p) => a + finalOf(p), 0)
  const pendentes = confirmed.filter((p) => (drafts[p.id]?.worked ?? p.worked) === null).length
  const anyDirty = confirmed.some(dirty)

  const save = async (p: PartRow) => {
    const d = drafts[p.id]
    if (!d) return
    setErr(null); setSaving(p.id)
    try {
      await updateParticipantClosing(p.id, { worked: d.worked, days: num(d.days), addition: num(d.addition), discount: num(d.discount), validation_notes: d.notes.trim() || null })
      setBase((b) => ({ ...b, [p.id]: d }))
    } catch (x) { setErr((x as Error).message) }
    setSaving(null)
  }

  const finish = async () => {
    setBusy(true); setErr(null)
    try { await finishEvent(e.id); reload() } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }

  const send = async () => {
    if (!confirm(`Enviar ${confirmed.filter((p) => finalOf(p) > 0).length} pagamento(s), total ${brl(total)}, ao financeiro? Depois disso os valores não podem mais ser alterados.`)) return
    setBusy(true); setErr(null)
    try { setSent(await sendEventToFinance(e.id)); reload() } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }

  const set = (id: string, patch: Partial<Draft>) => setDrafts((ds) => ({ ...ds, [id]: { ...(ds[id] as Draft), ...patch } }))
  const inp = 'w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-50'

  return (
    <div className="pb-28">
      <Link href={`/eventos/${e.id}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-400 hover:text-slate-700"><ArrowLeft className="h-4 w-4" />{e.name}</Link>
      <h1 className="text-2xl font-black text-slate-900">Fechamento operacional</h1>
      <p className="text-sm text-slate-400">{e.code} · {fmtDate(e.event_date)} · valor final = diária × quantidade + adicional − desconto</p>

      {err && <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>}

      {e.status === 'fechado' || sent !== null ? (
        <div className="mt-4 flex items-start gap-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <div className="font-black">Fechamento enviado ao financeiro</div>
            <p className="text-sm">{sent !== null ? `${sent} conta(s) a pagar gerada(s) automaticamente.` : 'As contas a pagar já foram geradas.'} O financeiro recebe nome, CPF, PIX, valor, código e data, sem precisar redigitar.</p>
            <Link href="/financeiro/contas-a-pagar" className="mt-2 inline-block text-sm font-bold underline">Ver contas a pagar</Link>
          </div>
        </div>
      ) : e.status !== 'aguardando_fechamento' ? (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">O fechamento começa quando o evento é encerrado. Encerrar fecha o check-in/check-out e marca &quot;trabalhou&quot; para quem fez check-in.</p>
          {canOperate && (
            <button onClick={finish} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}Encerrar evento e iniciar fechamento
            </button>
          )}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {confirmed.length === 0 && <EmptyState title="Nenhum profissional confirmado neste evento" />}
        {confirmed.map((p) => {
          const d = drafts[p.id] ?? toDraft(p)
          const cin = p.attendance.find((a) => a.kind === 'checkin')
          const cout = p.attendance.find((a) => a.kind === 'checkout')
          const f = finalOf(p)
          return (
            <div key={p.id} className={cn('rounded-3xl border bg-white p-4 shadow-sm', d.worked === null ? 'border-amber-200' : 'border-slate-100')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-black text-slate-800">{p.people?.full_name}</div>
                  <div className="text-xs text-slate-400">{teamName(p.team_id)} · entrada {hhmm(cin?.recorded_at)} · saída {hhmm(cout?.recorded_at)}{cin?.inside_radius === false && ' · check-in fora do raio'}</div>
                  {!p.people?.pix_key && <Pill tone="danger" className="mt-1">Sem chave PIX</Pill>}
                  {p.people?.pix_updated_publicly_at && <Pill tone="warning" className="mt-1">PIX alterado pelo link — conferir</Pill>}
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">Valor final</div>
                  <div className="text-xl font-black tabular-nums text-slate-900">{brl(f)}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                <div className="col-span-2">
                  <div className="mb-1 text-[11px] font-semibold uppercase text-slate-400">Trabalhou?</div>
                  <div className="flex gap-1">
                    {([[true, 'Sim'], [false, 'Não']] as const).map(([v, l]) => (
                      <button key={l} disabled={!editable} onClick={() => set(p.id, { worked: v })}
                        className={cn('flex-1 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-60',
                          d.worked === v ? (v ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-red-500 bg-red-500 text-white') : 'border-slate-200 text-slate-600')}>{l}</button>
                    ))}
                  </div>
                </div>
                <label className="text-[11px] font-semibold uppercase text-slate-400">Diárias<input disabled={!editable || d.worked !== true} inputMode="decimal" className={inp} value={d.days} onChange={(ev) => set(p.id, { days: ev.target.value })} /></label>
                <div className="text-[11px] font-semibold uppercase text-slate-400">Valor combinado<div className="py-2 text-sm font-bold normal-case text-slate-700">{brl(p.rate)}</div></div>
                <label className="text-[11px] font-semibold uppercase text-slate-400">Adicional<input disabled={!editable || d.worked !== true} inputMode="decimal" className={inp} value={d.addition} onChange={(ev) => set(p.id, { addition: ev.target.value })} /></label>
                <label className="text-[11px] font-semibold uppercase text-slate-400">Desconto<input disabled={!editable || d.worked !== true} inputMode="decimal" className={inp} value={d.discount} onChange={(ev) => set(p.id, { discount: ev.target.value })} /></label>
              </div>
              <div className="mt-2 flex gap-2">
                <input disabled={!editable} placeholder="Observação" className={inp} value={d.notes} onChange={(ev) => set(p.id, { notes: ev.target.value })} />
                {editable && dirty(p) && (
                  <button onClick={() => save(p)} disabled={saving === p.id} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-amber-500 px-4 text-sm font-bold text-white disabled:opacity-50">
                    {saving === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Salvar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {editable && (
        <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom,0px))] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-72">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="flex-1 text-sm text-slate-500">
              Total <b className="text-slate-900">{brl(total)}</b>
              {pendentes > 0 && <span className="ml-2 font-semibold text-amber-700">· {pendentes} sem validação</span>}
              {anyDirty && <span className="ml-2 font-semibold text-amber-700">· alterações não salvas</span>}
            </div>
            <button onClick={send} disabled={busy || pendentes > 0 || anyDirty}
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-amber-200 disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar para financeiro
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
