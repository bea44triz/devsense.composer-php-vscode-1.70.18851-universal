'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Loader2, UserMinus, UserPlus } from 'lucide-react'
import { brl, fmtDate, maskCpf, todayISO } from '@/lib/erp/ops'
import { addMember, updateMember, type FixedPost, type FixedMember } from '@/lib/erp/fixed-data'
import type { Person } from '@/lib/erp/people-data'
import { F, PersonPicker, field } from '../registry-ui'
import { EmptyState, ErrorBox, Modal, Pill } from '../ui'

const money = (v: string) => Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v) || 0

export function MembersTab({ p, canManage, onChanged }: { p: FixedPost; canManage: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<FixedMember | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const ativos = p.fixed_post_members.filter((m) => m.status === 'ativo')
  const inativos = p.fixed_post_members.filter((m) => m.status !== 'ativo')

  const desligar = async (m: FixedMember) => {
    if (!confirm(`Encerrar a alocação de ${m.people?.full_name}? Ele deixa de entrar nas próximas competências.`)) return
    setErr(null)
    try { await updateMember(m.id, { status: 'inativo', end_date: todayISO() }); onChanged() } catch (x) { setErr((x as Error).message) }
  }

  return (
    <div className="space-y-3">
      {err && <ErrorBox>{err}</ErrorBox>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500"><b className="text-slate-800">{ativos.length}</b> profissionais ativos · custo mensal <b className="text-slate-800">{brl(ativos.reduce((a, m) => a + Number(m.monthly_rate), 0))}</b></p>
        {canManage && p.status === 'ativo' && (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white"><UserPlus className="h-4 w-4" />Alocar profissional</button>
        )}
      </div>
      {ativos.length === 0 ? <EmptyState title="Nenhum profissional alocado" text="Aloque os profissionais e defina o valor mensal de cada um." /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {ativos.map((m) => (
            <li key={m.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-600">
                  {(m.people?.full_name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/pessoas/${m.person_id}`} className="block truncate font-bold text-slate-800 hover:text-amber-700">{m.people?.full_name}</Link>
                  <div className="text-xs text-slate-400">{m.role ?? 'Função não informada'} · CPF {maskCpf(m.people?.cpf ?? '')} · desde {fmtDate(m.start_date)}</div>
                  {!m.people?.has_pix && <Pill tone="danger" className="mt-1">Sem chave PIX</Pill>}
                </div>
                <div className="text-right">
                  <div className="text-lg font-black tabular-nums text-slate-900">{brl(m.monthly_rate)}</div>
                  <div className="text-[10px] font-semibold uppercase text-slate-400">por mês</div>
                </div>
              </div>
              {canManage && (
                <div className="mt-3 flex gap-1.5 border-t border-slate-100 pt-3">
                  <button onClick={() => setEditing(m)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">Editar valor/função</button>
                  <button onClick={() => desligar(m)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-red-600"><UserMinus className="h-3.5 w-3.5" />Encerrar alocação</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {inativos.length > 0 && (
        <details className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-500">Alocações encerradas ({inativos.length})</summary>
          <ul className="mt-2 space-y-1 text-slate-500">{inativos.map((m) => <li key={m.id}>{m.people?.full_name} · {fmtDate(m.start_date)} a {m.end_date ? fmtDate(m.end_date) : '—'} · {brl(m.monthly_rate)}</li>)}</ul>
        </details>
      )}
      {adding && <AddMember p={p} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onChanged() }} />}
      {editing && <EditMember m={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged() }} />}
    </div>
  )
}

function AddMember({ p, onClose, onSaved }: { p: FixedPost; onClose: () => void; onSaved: () => void }) {
  const [person, setPerson] = useState<Pick<Person, 'id' | 'full_name'> | null>(null)
  const [f, setF] = useState({ role: p.subcategory ?? p.category ?? '', start: todayISO(), monthly: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!person) return
    if (!(money(f.monthly) > 0)) return setErr('Informe o valor mensal.')
    setBusy(true); setErr(null)
    try { await addMember(p.company_id, p.id, person.id, f.role, f.start, money(f.monthly)); onSaved() }
    catch (x) { const m = (x as Error).message; setErr(m.includes('fixed_post_members_active_uq') ? 'Este profissional já está alocado neste ponto.' : m) }
    setBusy(false)
  }
  return (
    <Modal open onClose={onClose} title="Alocar profissional">
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">
        {err && <ErrorBox>{err}</ErrorBox>}
        {!person ? <PersonPicker companyId={p.company_id} onPick={setPerson} defaultRole={p.category ?? undefined} /> : (
          <>
            <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
              {person.full_name}<button onClick={() => setPerson(null)} className="text-xs font-semibold text-emerald-700 underline">trocar</button>
            </div>
            <F label="Função"><input className={field} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></F>
            <div className="grid grid-cols-2 gap-2">
              <F label="Início"><input type="date" className={field} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></F>
              <F label="Valor mensal (R$)"><input inputMode="decimal" className={field} value={f.monthly} onChange={(e) => setF({ ...f, monthly: e.target.value.replace(/[^\d,.]/g, '') })} placeholder="2.400,00" /></F>
            </div>
            <button onClick={save} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Alocar</button>
          </>
        )}
      </div>
    </Modal>
  )
}

function EditMember({ m, onClose, onSaved }: { m: FixedMember; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ role: m.role ?? '', monthly: String(m.monthly_rate) })
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!(money(f.monthly) > 0)) return setErr('Informe o valor mensal.')
    try { await updateMember(m.id, { role: f.role || null, monthly_rate: money(f.monthly) }); onSaved() } catch (x) { setErr((x as Error).message) }
  }
  return (
    <Modal open onClose={onClose} title={m.people?.full_name ?? 'Editar'}>
      <div className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <F label="Função"><input className={field} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></F>
        <F label="Valor mensal (R$)"><input inputMode="decimal" className={field} value={f.monthly} onChange={(e) => setF({ ...f, monthly: e.target.value })} /></F>
        <p className="text-xs text-slate-400">O novo valor vale para competências abertas daqui em diante; competências já abertas mantêm o valor base registrado.</p>
        <button onClick={save} className="w-full rounded-2xl bg-amber-500 py-3 font-bold text-white">Salvar</button>
      </div>
    </Modal>
  )
}
