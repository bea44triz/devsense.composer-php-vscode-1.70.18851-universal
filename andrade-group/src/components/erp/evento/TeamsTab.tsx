'use client'
import { useState } from 'react'
import { Clock, Lock, Pencil, RefreshCw, Unlock, User, Users } from 'lucide-react'
import { getSupabase } from '@/lib/supabase/client'
import { brl, fmtTime, pct } from '@/lib/erp/ops'
import { rotateLink, setTeamRegistrations, teamStats, type EventRow, type TeamRow } from '@/lib/erp/ops-data'
import { ErrorBox, LinkActions, Modal, Pill, Progress } from '../ui'

export function TeamsTab({ e, canOperate, onChanged, onViewTeam }: { e: EventRow; canOperate: boolean; onChanged: () => void; onViewTeam: (teamId: string) => void }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const [editing, setEditing] = useState<TeamRow | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const closed = e.status === 'fechado' || e.status === 'cancelado' || e.status === 'aguardando_fechamento'

  const rotate = async (t: TeamRow) => {
    if (!confirm(`Gerar um link novo para ${t.name}? O link atual deixa de funcionar imediatamente.`)) return
    setErr(null)
    try { await rotateLink('inscricao', t.id); onChanged() } catch (x) { setErr((x as Error).message) }
  }

  const toggle = async (t: TeamRow) => {
    setErr(null)
    try { await setTeamRegistrations(t.id, !t.registrations_open); onChanged() } catch (x) { setErr((x as Error).message) }
  }

  return (
    <div className="space-y-3">
      {err && <ErrorBox>{err}</ErrorBox>}
      <div className="grid gap-3 md:grid-cols-2">
        {teamStats(e).map(({ team: t, needed, confirmed, present, open, waiting }) => (
          <div key={t.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-black uppercase tracking-wide text-slate-800">{t.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{brl(t.rate)} / profissional</span>
                  {t.coordinator_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{t.coordinator_name}</span>}
                  {(t.start_time || t.end_time) && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime(t.start_time)}–{fmtTime(t.end_time)}</span>}
                </div>
              </div>
              {open === 0 ? <Pill tone="success">Completa</Pill> : t.registrations_open && !closed ? <Pill tone="info">Inscrições abertas</Pill> : <Pill>Inscrições encerradas</Pill>}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {([['Necess.', needed], ['Confirm.', confirmed], ['Presentes', present], ['Vagas', open]] as const).map(([l, v]) => (
                <div key={l} className={`rounded-xl py-1.5 ${l === 'Vagas' && v > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-700'}`}>
                  <div className="text-lg font-black tabular-nums">{v}</div><div className="text-[10px] font-semibold text-slate-400">{l}</div>
                </div>
              ))}
            </div>
            <Progress className="mt-3" value={pct(confirmed, needed)} tone={open === 0 ? 'success' : 'warning'} />
            {waiting > 0 && <p className="mt-2 text-xs font-semibold text-sky-700">{waiting} aguardando confirmação</p>}
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Link de inscrição</div>
              <LinkActions url={`${origin}/i/${t.invite_token}`} title={`Inscrição — ${t.name} · ${e.name}`} />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button onClick={() => onViewTeam(t.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"><Users className="h-3.5 w-3.5" />Ver equipe</button>
                {canOperate && !closed && (
                  <>
                    <button onClick={() => setEditing(t)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"><Pencil className="h-3.5 w-3.5" />Editar</button>
                    <button onClick={() => rotate(t)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"><RefreshCw className="h-3.5 w-3.5" />Novo link</button>
                    <button onClick={() => toggle(t)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                      {t.registrations_open ? <><Lock className="h-3.5 w-3.5" />Encerrar inscrições</> : <><Unlock className="h-3.5 w-3.5" />Reabrir inscrições</>}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && <EditTeam t={editing} confirmed={teamStats(e).find((x) => x.team.id === editing.id)?.confirmed ?? 0} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged() }} />}
    </div>
  )
}

function EditTeam({ t, confirmed, onClose, onSaved }: { t: TeamRow; confirmed: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ quantity: String(t.quantity), rate: String(t.rate), coordinator_name: t.coordinator_name ?? '', start_time: fmtTime(t.start_time), end_time: fmtTime(t.end_time) })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const field = 'w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'
  const save = async () => {
    const q = Number(f.quantity)
    if (!(q > 0)) return setErr('Quantidade inválida.')
    if (q < confirmed) return setErr(`Já há ${confirmed} confirmados nesta equipe. Cancele confirmações antes de reduzir.`)
    setBusy(true)
    const { error } = await getSupabase().from('event_teams').update({
      quantity: q, rate: Number(f.rate.replace(',', '.')) || 0, coordinator_name: f.coordinator_name.trim() || null,
      start_time: f.start_time || null, end_time: f.end_time || null,
    }).eq('id', t.id)
    setBusy(false)
    if (error) return setErr(error.message)
    onSaved()
  }
  return (
    <Modal open onClose={onClose} title={`Editar ${t.name}`}>
      <div className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-500">Quantidade<input inputMode="numeric" className={field} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="text-xs font-semibold text-slate-500">Valor (R$)<input inputMode="decimal" className={field} value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></label>
        </div>
        <label className="block text-xs font-semibold text-slate-500">Coordenador<input className={field} value={f.coordinator_name} onChange={(e) => setF({ ...f, coordinator_name: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-500">Das<input type="time" className={field} value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></label>
          <label className="text-xs font-semibold text-slate-500">Às<input type="time" className={field} value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></label>
        </div>
        <p className="text-xs text-slate-400">O novo valor vale para as próximas inscrições. Quem já se inscreveu mantém o valor combinado (ajustável no fechamento).</p>
        <button onClick={save} disabled={busy} className="w-full rounded-2xl bg-amber-500 py-3 font-bold text-white disabled:opacity-50">Salvar</button>
      </div>
    </Modal>
  )
}
