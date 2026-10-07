'use client'
import { useState } from 'react'
import Link from 'next/link'
import { CalendarPlus, CheckCircle2, Loader2, RotateCcw, Send, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { brl, fmtCompetence, periodItemFinal } from '@/lib/erp/ops'
import { absenceDiscount, currentCompetence, openPeriod, reopenPeriod, sendPeriod, updateItem, validatePeriod, type FixedPost, type Period, type PeriodItem } from '@/lib/erp/fixed-data'
import { EmptyState, ErrorBox, Pill, type Tone } from '../ui'

const STATUS: Record<Period['status'], { label: string; tone: Tone }> = {
  aberta: { label: 'Em conferência', tone: 'info' }, validada: { label: 'Validada', tone: 'warning' }, enviada: { label: 'Enviada ao financeiro', tone: 'success' },
}
interface Draft { absences: string; discount: string; addition: string; notes: string; status: PeriodItem['status'] }
const toDraft = (i: PeriodItem): Draft => ({ absences: String(i.absences), discount: String(i.discount), addition: String(i.addition), notes: i.notes ?? '', status: i.status })
const num = (v: string) => Number(String(v).replace(',', '.')) || 0

export function PeriodsTab({ p, canManage, onChanged }: { p: FixedPost; canManage: boolean; onChanged: () => void }) {
  const periods = [...p.fixed_post_periods].sort((a, b) => b.competence.localeCompare(a.competence))
  const [selected, setSelected] = useState<string | null>(periods[0]?.id ?? null)
  const [month, setMonth] = useState(currentCompetence().slice(0, 7))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const period = periods.find((x) => x.id === selected) ?? periods[0]

  const open = async () => {
    setBusy(true); setErr(null)
    try { setSelected(await openPeriod(p.id, `${month}-01`)); onChanged() } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      {err && <ErrorBox>{err}</ErrorBox>}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-1 gap-1.5 overflow-x-auto">
          {periods.map((x) => (
            <button key={x.id} onClick={() => setSelected(x.id)}
              className={cn('whitespace-nowrap rounded-2xl border px-3 py-2 text-left', period?.id === x.id ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white')}>
              <div className="text-sm font-black text-slate-800">{fmtCompetence(x.competence)}</div>
              <div className="text-[10px] font-semibold text-slate-400">{STATUS[x.status].label}</div>
            </button>
          ))}
        </div>
        {canManage && p.status === 'ativo' && (
          <div className="flex items-end gap-2">
            <label className="text-[11px] font-semibold uppercase text-slate-400">Competência
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="block rounded-xl border border-slate-200 px-2 py-2 text-sm" aria-label="Mês da competência" />
            </label>
            <button onClick={open} disabled={busy || !month} className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}Abrir competência
            </button>
          </div>
        )}
      </div>
      {!period ? <EmptyState title="Nenhuma competência aberta" text="Abra a competência do mês para conferir os profissionais." />
        : <PeriodView key={`${period.id}:${period.status}`} p={p} period={period} canManage={canManage} onChanged={onChanged} />}
    </div>
  )
}

function PeriodView({ p, period, canManage, onChanged }: { p: FixedPost; period: Period; canManage: boolean; onChanged: () => void }) {
  const items = [...period.fixed_post_period_items].sort((a, b) => (a.people?.full_name ?? '').localeCompare(b.people?.full_name ?? ''))
  const [base, setBase] = useState<Record<string, Draft>>(() => Object.fromEntries(items.map((i) => [i.id, toDraft(i)])))
  const [drafts, setDrafts] = useState<Record<string, Draft>>(base)
  const [saving, setSaving] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState<number | null>(null)
  const editable = canManage && period.status === 'aberta'
  const dirty = (id: string) => JSON.stringify(drafts[id]) !== JSON.stringify(base[id])
  const final = (i: PeriodItem) => { const d = drafts[i.id] ?? toDraft(i); return periodItemFinal({ base_amount: Number(i.base_amount), addition: num(d.addition), discount: num(d.discount) }) }
  const total = items.reduce((a, i) => a + final(i), 0)
  const pend = items.filter((i) => (drafts[i.id]?.status ?? i.status) !== 'conferido').length
  const anyDirty = items.some((i) => dirty(i.id))
  const set = (id: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...(d[id] as Draft), ...patch } }))

  const save = async (i: PeriodItem) => {
    const d = drafts[i.id]; if (!d) return
    setSaving(i.id); setErr(null)
    try {
      await updateItem(i.id, { absences: Math.max(0, Math.round(num(d.absences))), discount: num(d.discount), addition: num(d.addition), notes: d.notes.trim() || null, status: d.status })
      setBase((b) => ({ ...b, [i.id]: d }))
    } catch (x) { setErr((x as Error).message) }
    setSaving(null)
  }
  const run = async (fn: () => Promise<unknown>, after?: (r: unknown) => void) => {
    setBusy(true); setErr(null)
    try { const r = await fn(); after?.(r); onChanged() } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  const inp = 'w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-50'

  return (
    <div className="space-y-3 pb-24">
      {err && <ErrorBox>{err}</ErrorBox>}
      <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-slate-900 px-5 py-4 text-white">
        <div className="flex-1">
          <div className="text-[11px] font-bold uppercase tracking-widest text-amber-300">Competência</div>
          <div className="text-xl font-black">{fmtCompetence(period.competence)}</div>
        </div>
        <Pill tone={STATUS[period.status].tone}>{STATUS[period.status].label}</Pill>
        <div className="text-right"><div className="text-[11px] font-semibold uppercase text-slate-400">Total</div><div className="text-xl font-black tabular-nums">{brl(total)}</div></div>
      </div>
      {(period.status === 'enviada' || sent !== null) && (
        <div className="flex items-start gap-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>{sent !== null ? `${sent} conta(s) a pagar gerada(s).` : 'Competência enviada ao financeiro.'} Nome, CPF, PIX, valor, ponto fixo, competência e centro de custo seguem prontos. <Link href="/financeiro/contas-a-pagar" className="font-bold underline">Ver contas a pagar</Link></div>
        </div>
      )}
      {items.length === 0 && <EmptyState title="Sem profissionais nesta competência" text="Aloque profissionais e abra a competência novamente para incluí-los." />}
      {items.map((i) => {
        const d = drafts[i.id] ?? toDraft(i)
        const conferido = d.status === 'conferido'
        return (
          <div key={i.id} className={cn('rounded-3xl border bg-white p-4 shadow-sm', conferido ? 'border-emerald-200' : 'border-slate-100')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-black text-slate-800">{i.people?.full_name}</div>
                <div className="text-xs text-slate-400">Valor base {brl(i.base_amount)}</div>
                {!i.people?.has_pix && <Pill tone="danger" className="mt-1">Sem chave PIX</Pill>}
                {i.people?.pix_updated_publicly_at && <Pill tone="warning" className="mt-1">PIX alterado pelo link — conferir</Pill>}
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold uppercase text-slate-400">Valor final</div>
                <div className={cn('text-xl font-black tabular-nums', final(i) < 0 ? 'text-red-600' : 'text-slate-900')}>{brl(final(i))}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <label className="text-[11px] font-semibold uppercase text-slate-400">Faltas
                <div className="flex gap-1">
                  <input disabled={!editable} inputMode="numeric" className={inp} value={d.absences} onChange={(e) => set(i.id, { absences: e.target.value.replace(/\D/g, '') })} />
                  {editable && Number(d.absences) > 0 && (
                    <button type="button" title="Calcular desconto (base ÷ 30 × faltas)" aria-label="Calcular desconto das faltas" onClick={() => set(i.id, { discount: String(absenceDiscount(i.base_amount, Number(d.absences))) })} className="rounded-xl border border-slate-200 px-2 text-amber-600"><Wand2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              </label>
              <label className="text-[11px] font-semibold uppercase text-slate-400">Descontos<input disabled={!editable} inputMode="decimal" className={inp} value={d.discount} onChange={(e) => set(i.id, { discount: e.target.value })} /></label>
              <label className="text-[11px] font-semibold uppercase text-slate-400">Adicionais<input disabled={!editable} inputMode="decimal" className={inp} value={d.addition} onChange={(e) => set(i.id, { addition: e.target.value })} /></label>
              <label className="col-span-2 text-[11px] font-semibold uppercase text-slate-400">Observação<input disabled={!editable} className={inp} value={d.notes} onChange={(e) => set(i.id, { notes: e.target.value })} /></label>
            </div>
            {editable && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => set(i.id, { status: conferido ? 'pendente' : 'conferido' })}
                  className={cn('inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold', conferido ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 text-slate-600')}>
                  <CheckCircle2 className="h-3.5 w-3.5" />{conferido ? 'Conferido' : 'Marcar como conferido'}
                </button>
                {dirty(i.id) && (
                  <button onClick={() => save(i)} disabled={saving === i.id} className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                    {saving === i.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Salvar
                  </button>
                )}
              </div>
            )}
            {!editable && <div className="mt-2"><Pill tone={conferido ? 'success' : 'muted'}>{conferido ? 'Conferido' : 'Pendente'}</Pill></div>}
          </div>
        )
      })}

      {canManage && period.status !== 'enviada' && sent === null && (
        <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom,0px))] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-72">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
            <div className="flex-1 text-sm text-slate-500">
              {p.name} · Total <b className="text-slate-900">{brl(total)}</b>
              {period.status === 'aberta' && pend > 0 && <span className="ml-2 font-semibold text-amber-700">· {pend} a conferir</span>}
              {anyDirty && <span className="ml-2 font-semibold text-amber-700">· alterações não salvas</span>}
            </div>
            {period.status === 'aberta' ? (
              <button onClick={() => run(() => validatePeriod(period.id))} disabled={busy || pend > 0 || anyDirty}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Validar competência
              </button>
            ) : (
              <>
                <button onClick={() => run(() => reopenPeriod(period.id))} disabled={busy} className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"><RotateCcw className="h-4 w-4" />Reabrir</button>
                <button onClick={() => { if (confirm(`Enviar ${items.filter((i) => final(i) > 0).length} pagamento(s), total ${brl(total)}, ao financeiro?`)) run(() => sendPeriod(period.id), (n) => setSent(n as number)) }} disabled={busy}
                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-amber-200 disabled:opacity-40">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar para financeiro
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
