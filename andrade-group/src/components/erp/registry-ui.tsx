'use client'
import { useState } from 'react'
import { Loader2, Plus, Search, Trash2, UserPlus } from 'lucide-react'
import { cn, formatCpf, formatPhone, onlyDigits } from '@/lib/utils'
import { useLoad } from '@/lib/erp/use-load'
import { ccLabel, clienteLabel, fetchCentros, fetchClientes, saveCentro, saveCliente } from '@/lib/erp/registry-data'
import { fetchAssignableUsers, fetchMembers, setMember, type MemberRow } from '@/lib/erp/ops-data'
import { searchPeople, upsertPerson, type Person } from '@/lib/erp/people-data'
import { ErrorBox, Modal } from './ui'

export const field = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-50'

export function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={cn('flex flex-col gap-1.5', className)}><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>
}

/** Select de cliente da empresa com cadastro rápido (só quem pode cadastrar vê o "+ novo"). */
export function ClienteSelect({ companyId, value, onChange, canCreate, label = 'Cliente' }: { companyId: string; value: string; onChange: (id: string) => void; canCreate: boolean; label?: string }) {
  const list = useLoad(() => fetchClientes([companyId]), `cli:${companyId}`)
  const [open, setOpen] = useState(false)
  return (
    <F label={label}>
      <div className="flex gap-2">
        <select className={field} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
          <option value="">Selecione…</option>
          {(list.data ?? []).filter((c) => c.status === 'ativo' || c.id === value).map((c) => <option key={c.id} value={c.id}>{clienteLabel(c)}</option>)}
        </select>
        {canCreate && <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-2xl border border-slate-200 px-3 text-slate-500 hover:border-amber-400 hover:text-amber-600" aria-label="Novo cliente"><Plus className="h-4 w-4" /></button>}
      </div>
      {open && <ClienteModal companyId={companyId} onClose={() => setOpen(false)} onSaved={(id) => { setOpen(false); list.reload(); onChange(id) }} />}
    </F>
  )
}

export function ClienteModal({ companyId, initial, onClose, onSaved }: { companyId: string; initial?: Parameters<typeof saveCliente>[0]; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState({ tipo_pessoa: 'PJ' as 'PF' | 'PJ', razao_social: '', nome_fantasia: '', documento: '', telefone: '', email: '', status: 'ativo' as 'ativo' | 'inativo', ...initial })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!f.razao_social?.trim()) return setErr('Informe o nome / razão social.')
    setBusy(true); setErr(null)
    try { onSaved(await saveCliente({ ...f, company_id: companyId, razao_social: f.razao_social, documento: onlyDigits(f.documento ?? '') || null })) }
    catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  return (
    <Modal open onClose={onClose} title={initial?.id ? 'Editar cliente' : 'Novo cliente'}>
      <div className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <div className="flex gap-2">{(['PJ', 'PF'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setF({ ...f, tipo_pessoa: t })} className={cn('rounded-xl border px-3 py-1.5 text-xs font-bold', f.tipo_pessoa === t ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 text-slate-600')}>{t === 'PJ' ? 'Empresa' : 'Pessoa física'}</button>
        ))}</div>
        <F label={f.tipo_pessoa === 'PJ' ? 'Razão social' : 'Nome'}><input className={field} value={f.razao_social ?? ''} onChange={(e) => setF({ ...f, razao_social: e.target.value })} /></F>
        {f.tipo_pessoa === 'PJ' && <F label="Nome fantasia"><input className={field} value={f.nome_fantasia ?? ''} onChange={(e) => setF({ ...f, nome_fantasia: e.target.value })} /></F>}
        <div className="grid grid-cols-2 gap-2">
          <F label={f.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'}><input className={field} inputMode="numeric" value={f.documento ?? ''} onChange={(e) => setF({ ...f, documento: e.target.value })} /></F>
          <F label="Telefone"><input className={field} inputMode="tel" value={f.telefone ?? ''} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></F>
        </div>
        <F label="E-mail"><input className={field} type="email" value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></F>
        {initial?.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-amber-500" checked={f.status === 'ativo'} onChange={(e) => setF({ ...f, status: e.target.checked ? 'ativo' : 'inativo' })} />Ativo</label>}
        <button onClick={save} disabled={busy} className="w-full rounded-2xl bg-amber-500 py-3 font-bold text-white disabled:opacity-50">Salvar cliente</button>
      </div>
    </Modal>
  )
}

export function CentroSelect({ companyId, value, onChange, canCreate }: { companyId: string; value: string; onChange: (id: string) => void; canCreate: boolean }) {
  const list = useLoad(() => fetchCentros([companyId]), `cc:${companyId}`)
  const [open, setOpen] = useState(false)
  return (
    <F label="Centro de custo">
      <div className="flex gap-2">
        <select className={field} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Centro de custo">
          <option value="">Selecione…</option>
          {(list.data ?? []).filter((c) => c.status === 'ativo' || c.id === value).map((c) => <option key={c.id} value={c.id}>{ccLabel(c)}</option>)}
        </select>
        {canCreate && <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-2xl border border-slate-200 px-3 text-slate-500 hover:border-amber-400 hover:text-amber-600" aria-label="Novo centro de custo"><Plus className="h-4 w-4" /></button>}
      </div>
      {open && <CentroModal companyId={companyId} onClose={() => setOpen(false)} onSaved={(id) => { setOpen(false); list.reload(); onChange(id) }} />}
    </F>
  )
}

export function CentroModal({ companyId, initial, onClose, onSaved }: { companyId: string; initial?: Parameters<typeof saveCentro>[0]; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState({ codigo: '', nome: '', origem: 'interno' as 'interno' | 'conta_azul' | 'importacao', id_externo: '', status: 'ativo' as 'ativo' | 'inativo', ...initial })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!f.codigo?.trim() || !f.nome?.trim()) return setErr('Informe código e nome.')
    setBusy(true); setErr(null)
    try { onSaved(await saveCentro({ ...f, company_id: companyId, codigo: f.codigo, nome: f.nome })) }
    catch (x) { setErr((x as Error).message.includes('centros_custo_company_id_codigo') ? 'Já existe um centro de custo com esse código.' : (x as Error).message) }
    setBusy(false)
  }
  return (
    <Modal open onClose={onClose} title={initial?.id ? 'Editar centro de custo' : 'Novo centro de custo'}>
      <div className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <F label="Código"><input className={field} value={f.codigo ?? ''} onChange={(e) => setF({ ...f, codigo: e.target.value })} /></F>
          <F label="Nome"><input className={field} value={f.nome ?? ''} onChange={(e) => setF({ ...f, nome: e.target.value })} /></F>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <F label="Origem">
            <select className={field} value={f.origem} onChange={(e) => setF({ ...f, origem: e.target.value as typeof f.origem })}>
              <option value="interno">Interno</option><option value="conta_azul">Conta Azul</option><option value="importacao">Importação</option>
            </select>
          </F>
          <F label="ID externo"><input className={field} value={f.id_externo ?? ''} onChange={(e) => setF({ ...f, id_externo: e.target.value })} placeholder="opcional" /></F>
        </div>
        {initial?.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-amber-500" checked={f.status === 'ativo'} onChange={(e) => setF({ ...f, status: e.target.checked ? 'ativo' : 'inativo' })} />Ativo</label>}
        <button onClick={save} disabled={busy} className="w-full rounded-2xl bg-amber-500 py-3 font-bold text-white disabled:opacity-50">Salvar</button>
      </div>
    </Modal>
  )
}

const ROLE_LABEL: Record<MemberRow['role'], string> = { responsavel: 'Responsável', coordenador: 'Coordenador', lider: 'Líder' }

/** Quem conduz a operação. Coordenadores/líderes só enxergam as operações em que estão aqui (regra do banco). */
export function MembersCard({ operationId, companyId, canAssign }: { operationId: string; companyId: string; canAssign: boolean }) {
  const members = useLoad(() => fetchMembers(operationId), `mem:${operationId}`)
  const users = useLoad(() => (canAssign ? fetchAssignableUsers(companyId) : Promise.resolve([])), `au:${companyId}:${canAssign}`)
  const [pick, setPick] = useState({ user: '', role: 'coordenador' as MemberRow['role'] })
  const [err, setErr] = useState<string | null>(null)
  const act = async (user: string, role: MemberRow['role'], remove = false) => {
    setErr(null)
    try { await setMember(operationId, user, role, remove); setPick({ user: '', role: 'coordenador' }); members.reload() } catch (x) { setErr((x as Error).message) }
  }
  const available = (users.data ?? []).filter((u) => !(members.data ?? []).some((m) => m.user_id === u.user_id))
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Responsáveis / coordenadores</div>
      {err && <div className="mb-2"><ErrorBox>{err}</ErrorBox></div>}
      <ul className="space-y-1.5">
        {(members.data ?? []).map((m) => (
          <li key={m.user_id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate font-semibold text-slate-700">{m.full_name}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{ROLE_LABEL[m.role]}</span>
            {canAssign && <button onClick={() => act(m.user_id, m.role, true)} className="rounded-lg p-1 text-slate-300 hover:text-red-500" aria-label={`Remover ${m.full_name}`}><Trash2 className="h-3.5 w-3.5" /></button>}
          </li>
        ))}
        {members.data?.length === 0 && <li className="text-sm text-slate-400">Ninguém vinculado.</li>}
      </ul>
      {canAssign && available.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <select className="flex-1 rounded-xl border border-slate-200 px-2 py-2 text-sm" value={pick.user} onChange={(e) => setPick({ ...pick, user: e.target.value })} aria-label="Usuário">
            <option value="">Adicionar pessoa da equipe interna…</option>
            {available.map((u) => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
          </select>
          <select className="rounded-xl border border-slate-200 px-2 py-2 text-sm" value={pick.role} onChange={(e) => setPick({ ...pick, role: e.target.value as MemberRow['role'] })} aria-label="Papel">
            {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button disabled={!pick.user} onClick={() => act(pick.user, pick.role)} className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><UserPlus className="h-3.5 w-3.5" />Vincular</button>
        </div>
      )}
    </div>
  )
}

const PIX_TIPOS = [['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['celular', 'Celular'], ['email', 'E-mail'], ['aleatoria', 'Aleatória']] as const

/** Busca profissional da empresa por nome/CPF; se não existir, cadastra (CPF não duplica). */
export function PersonPicker({ companyId, onPick, defaultRole }: { companyId: string; onPick: (p: Pick<Person, 'id' | 'full_name'>) => void; defaultRole?: string }) {
  const [term, setTerm] = useState('')
  const [res, setRes] = useState<Person[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [novo, setNovo] = useState(false)
  const [f, setF] = useState({ full_name: '', cpf: '', phone: '', email: '', pix_type: 'cpf', pix_key: '' })
  const [err, setErr] = useState<string | null>(null)
  const search = async () => {
    setErr(null); setBusy(true)
    try { setRes(await searchPeople(companyId, term)) } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  const create = async () => {
    setErr(null); setBusy(true)
    try {
      const id = await upsertPerson(companyId, { ...f, cpf: onlyDigits(f.cpf), phone: onlyDigits(f.phone), main_role: defaultRole })
      onPick({ id, full_name: f.full_name })
    } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  return (
    <div className="space-y-3">
      {err && <ErrorBox>{err}</ErrorBox>}
      {!novo ? (
        <>
          <form onSubmit={(e) => { e.preventDefault(); search() }} className="flex gap-2">
            <input className={field} placeholder="Nome ou CPF" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Buscar profissional" />
            <button className="shrink-0 rounded-2xl bg-slate-900 px-4 text-white" aria-label="Buscar">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button>
          </form>
          {res && (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
              {res.map((p) => (
                <li key={p.id}><button type="button" onClick={() => onPick(p)} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-amber-50">
                  <span className="font-semibold text-slate-700">{p.full_name}</span><span className="text-xs text-slate-400">{formatCpf(p.cpf)}</span></button></li>
              ))}
              {res.length === 0 && <li className="px-3 py-2.5 text-sm text-slate-400">Nenhum profissional encontrado.</li>}
            </ul>
          )}
          <button type="button" onClick={() => setNovo(true)} className="flex items-center gap-1.5 text-sm font-bold text-amber-600"><UserPlus className="h-4 w-4" />Cadastrar novo profissional</button>
        </>
      ) : (
        <div className="space-y-2">
          <input className={field} placeholder="Nome completo" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} aria-label="Nome completo" />
          <div className="grid grid-cols-2 gap-2">
            <input className={field} placeholder="CPF" inputMode="numeric" value={formatCpf(f.cpf)} maxLength={14} onChange={(e) => setF({ ...f, cpf: onlyDigits(e.target.value) })} aria-label="CPF" />
            <input className={field} placeholder="Celular" inputMode="tel" value={formatPhone(f.phone)} maxLength={15} onChange={(e) => setF({ ...f, phone: onlyDigits(e.target.value) })} aria-label="Celular" />
          </div>
          <input className={field} placeholder="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="E-mail" />
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <select className={field} value={f.pix_type} onChange={(e) => setF({ ...f, pix_type: e.target.value, pix_key: '' })} aria-label="Tipo PIX">
              {PIX_TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input className={field} placeholder="Chave PIX" value={f.pix_key} onChange={(e) => setF({ ...f, pix_key: e.target.value })} aria-label="Chave PIX" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setNovo(false)} className="rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-500">Voltar</button>
            <button type="button" onClick={create} disabled={busy} className="flex-1 rounded-2xl bg-amber-500 py-3 font-bold text-white disabled:opacity-50">Cadastrar e selecionar</button>
          </div>
        </div>
      )}
    </div>
  )
}
