'use client'
import { useState } from 'react'
import { Link2, Search, ShieldCheck, Unlink, UserMinus, UserPlus, Users } from 'lucide-react'
import { useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { fetchEvents, setMember } from '@/lib/erp/ops-data'
import { fetchFixedPosts } from '@/lib/erp/fixed-data'
import {
  fetchCompanyUsers, fetchUserOperations, lookupUserByEmail, revokeCompanyUser, roleLabelFor,
  setCompanyUserAccess, ROLE_PRESETS, type CompanyUserRow, type UserOperationRow,
} from '@/lib/erp/users-data'
import { PERMISSION_LABELS, type Permission } from '@/lib/erp/environment-rules'
import { EmptyState, ErrorBox, Modal, Pill, Spinner } from '@/components/erp/ui'
import { field } from '@/components/erp/registry-ui'

export default function UsuariosPage() {
  const s = useScope()
  const list = useLoad(() => fetchCompanyUsers(s.companyId ?? ''), `users:${s.companyId}`)
  const [invite, setInvite] = useState(false)
  const [edit, setEdit] = useState<CompanyUserRow | null>(null)

  if (!s.canManageUsers) {
    return <EmptyState title="Sem permissão" text="Só administradores da empresa ou quem tem a permissão de gerenciar usuários acessa esta tela." />
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Usuários e Permissões</h1>
          <p className="text-sm text-slate-400">Acesso de {s.companyName(s.companyId ?? '')} — quem entra, com qual papel, e em quais eventos/pontos fixos.</p>
        </div>
        <button onClick={() => setInvite(true)} className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white"><UserPlus className="h-4 w-4" />Conceder acesso</button>
      </div>
      {list.error && <ErrorBox>{list.error}</ErrorBox>}
      {list.loading ? <Spinner /> : (list.data ?? []).length === 0 ? <EmptyState title="Nenhum usuário com acesso a esta empresa ainda" /> : (
        <ul className="space-y-2">
          {(list.data ?? []).map((u) => (
            <li key={u.user_id}>
              <button onClick={() => setEdit(u)} className="flex w-full items-center justify-between gap-3 rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-sm hover:border-amber-200">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-black text-slate-800">
                    {u.full_name || u.email}
                    {u.is_platform_admin && <Pill tone="warning"><ShieldCheck className="mr-1 inline h-3 w-3" />Super Admin</Pill>}
                    {!u.active && <Pill tone="muted">Inativo</Pill>}
                  </div>
                  <div className="truncate text-xs text-slate-400">{u.email}</div>
                  <div className="mt-1 text-xs font-semibold text-amber-600">{roleLabelFor(u.permissions)}</div>
                </div>
                <div className="shrink-0 text-right text-xs text-slate-400">
                  <div className="font-bold text-slate-600">{u.operations_count}</div>
                  <div>operações</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {invite && s.companyId && <GrantModal companyId={s.companyId} onClose={() => setInvite(false)} onDone={() => { setInvite(false); list.reload() }} />}
      {edit && s.companyId && <EditUserModal companyId={s.companyId} user={edit} onClose={() => setEdit(null)} onChanged={() => list.reload()} />}
    </div>
  )
}

function PermissionPicker({ value, onChange }: { value: Permission[]; onChange: (p: Permission[]) => void }) {
  const [preset, setPreset] = useState(() => ROLE_PRESETS.find((r) => r.key !== 'custom' && r.perms.length === value.length && r.perms.every((p) => value.includes(p)))?.key ?? 'custom')
  const applyPreset = (key: string) => {
    setPreset(key)
    const r = ROLE_PRESETS.find((x) => x.key === key)
    if (r && r.key !== 'custom') onChange(r.perms)
  }
  const toggle = (p: Permission) => { setPreset('custom'); onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]) }
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Papel</div>
        <select className={field} aria-label="Papel" value={preset} onChange={(e) => applyPreset(e.target.value)}>
          {ROLE_PRESETS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Permissões</div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {(Object.keys(PERMISSION_LABELS) as Permission[]).filter((p) => p !== 'operacao.todos' || value.includes('operacao.gerenciar') || true).map((p) => (
            <label key={p} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm">
              <input type="checkbox" className="accent-amber-500" checked={value.includes(p)} onChange={() => toggle(p)} />
              {PERMISSION_LABELS[p]}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function GrantModal({ companyId, onClose, onDone }: { companyId: string; onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [found, setFound] = useState<{ user_id: string; email: string; full_name: string | null; already_linked: boolean }[] | null>(null)
  const [perms, setPerms] = useState<Permission[]>(['operacao.ver'])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const search = async () => {
    setErr(null); setFound(null); setBusy(true)
    try { setFound(await lookupUserByEmail(companyId, email)) } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  const grant = async (userId: string) => {
    setBusy(true); setErr(null)
    try { await setCompanyUserAccess(companyId, userId, true, perms); onDone() }
    catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  return (
    <Modal open onClose={onClose} title="Conceder acesso">
      <div className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <div className="flex gap-2">
          <input className={field} placeholder="E-mail do usuário" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
          <button onClick={search} disabled={busy || !email.trim()} aria-label="Buscar" className="shrink-0 rounded-2xl bg-slate-900 px-4 text-white disabled:opacity-50"><Search className="h-4 w-4" /></button>
        </div>
        {found && found.length === 0 && (
          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">
            Nenhum usuário com este e-mail. A pessoa precisa primeiro criar a própria conta em <b>/entrar</b> — ainda não há convite por e-mail (precisa de e-mail configurado no projeto).
          </div>
        )}
        {found && found.length > 0 && (
          <div className="space-y-3">
            {found.map((u) => (
              <div key={u.user_id} className="rounded-2xl border border-slate-100 p-3">
                <div className="font-bold text-slate-800">{u.full_name || u.email}</div>
                <div className="text-xs text-slate-400">{u.email}{u.already_linked && ' · já tem acesso a esta empresa'}</div>
              </div>
            ))}
            <PermissionPicker value={perms} onChange={setPerms} />
            <button onClick={() => grant(found[0].user_id)} disabled={busy} className="w-full rounded-2xl bg-amber-500 py-3 font-bold text-white disabled:opacity-50">
              {found[0].already_linked ? 'Atualizar permissões' : 'Conceder acesso'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function EditUserModal({ companyId, user, onClose, onChanged }: { companyId: string; user: CompanyUserRow; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<'acesso' | 'operacoes'>('acesso')
  const [active, setActive] = useState(user.active)
  const [perms, setPerms] = useState<Permission[]>(user.permissions)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ops = useLoad(() => fetchUserOperations(companyId, user.user_id), `userops:${companyId}:${user.user_id}`, { enabled: tab === 'operacoes' })

  const save = async () => {
    setBusy(true); setErr(null)
    try { await setCompanyUserAccess(companyId, user.user_id, active, perms); onChanged(); onClose() }
    catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  const revoke = async () => {
    if (!confirm(`Revogar todo o acesso de ${user.full_name || user.email} a esta empresa?`)) return
    setBusy(true); setErr(null)
    try { await revokeCompanyUser(companyId, user.user_id); onChanged(); onClose() }
    catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  return (
    <Modal open onClose={onClose} title={user.full_name || user.email}>
      <div className="space-y-3">
        {err && <ErrorBox>{err}</ErrorBox>}
        <div className="flex gap-2 border-b border-slate-100 pb-2 text-sm font-bold">
          <button onClick={() => setTab('acesso')} className={tab === 'acesso' ? 'text-amber-600' : 'text-slate-400'}>Acesso</button>
          <button onClick={() => setTab('operacoes')} className={tab === 'operacoes' ? 'text-amber-600' : 'text-slate-400'}><Users className="mr-1 inline h-3.5 w-3.5" />Eventos e Pontos Fixos</button>
        </div>
        {tab === 'acesso' && (
          <div className="space-y-3">
            {user.is_platform_admin && <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Este usuário também é Super Admin da plataforma (concedido fora desta tela, por acesso direto ao banco).</div>}
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="accent-amber-500" checked={active} onChange={(e) => setActive(e.target.checked)} />Ativo nesta empresa</label>
            <PermissionPicker value={perms} onChange={setPerms} />
            <div className="flex gap-2">
              <button onClick={save} disabled={busy} className="flex-1 rounded-2xl bg-amber-500 py-3 font-bold text-white disabled:opacity-50">Salvar</button>
              <button onClick={revoke} disabled={busy} className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 text-sm font-bold text-red-600 disabled:opacity-50"><UserMinus className="h-4 w-4" />Revogar acesso</button>
            </div>
          </div>
        )}
        {tab === 'operacoes' && (
          <OperationsTab companyId={companyId} userId={user.user_id} operations={ops.data ?? []} loading={ops.loading} onChanged={ops.reload} />
        )}
      </div>
    </Modal>
  )
}

function OperationsTab({ companyId, userId, operations, loading, onChanged }: {
  companyId: string; userId: string; operations: UserOperationRow[]; loading: boolean; onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [type, setType] = useState<'EVENTO' | 'PONTO_FIXO'>('EVENTO')
  const [opId, setOpId] = useState('')
  const [role, setRole] = useState<'responsavel' | 'coordenador' | 'lider'>('coordenador')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const events = useLoad(() => fetchEvents([companyId]), `evlist:${companyId}`, { enabled: adding && type === 'EVENTO' })
  const posts = useLoad(() => fetchFixedPosts([companyId]), `pflist:${companyId}`, { enabled: adding && type === 'PONTO_FIXO' })
  const options = type === 'EVENTO' ? (events.data ?? []) : (posts.data ?? [])

  const add = async () => {
    if (!opId) return
    setBusy(true); setErr(null)
    try { await setMember(opId, userId, role); setAdding(false); setOpId(''); onChanged() }
    catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  const remove = async (operationId: string) => {
    setBusy(true); setErr(null)
    try { await setMember(operationId, userId, 'coordenador', true); onChanged() }
    catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  return (
    <div className="space-y-3">
      {err && <ErrorBox>{err}</ErrorBox>}
      {loading ? <Spinner /> : operations.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Sem eventos ou pontos fixos atribuídos.</div>
      ) : (
        <ul className="space-y-1.5">
          {operations.map((o) => (
            <li key={o.operation_id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-bold text-slate-700">{o.name} <span className="font-normal text-slate-400">· {o.code}</span></div>
                <div className="text-xs text-slate-400">{o.type === 'EVENTO' ? 'Evento' : 'Ponto Fixo'} · {o.role}</div>
              </div>
              <button onClick={() => remove(o.operation_id)} disabled={busy} className="shrink-0 text-red-500 disabled:opacity-50" aria-label="Remover vínculo"><Unlink className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {!adding ? (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-2 text-sm font-bold text-amber-600"><Link2 className="h-4 w-4" />Vincular a evento ou ponto fixo</button>
      ) : (
        <div className="space-y-2 rounded-2xl border border-slate-100 p-3">
          <div className="flex gap-2">
            {(['EVENTO', 'PONTO_FIXO'] as const).map((t) => (
              <button key={t} onClick={() => { setType(t); setOpId('') }} className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${type === t ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 text-slate-600'}`}>
                {t === 'EVENTO' ? 'Evento' : 'Ponto Fixo'}
              </button>
            ))}
          </div>
          <select className={field} aria-label="Evento ou ponto fixo" value={opId} onChange={(e) => setOpId(e.target.value)}>
            <option value="">Selecione…</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name} — {o.code}</option>)}
          </select>
          <select className={field} aria-label="Papel na operação" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="coordenador">Coordenador</option>
            <option value="responsavel">Responsável</option>
            <option value="lider">Líder</option>
          </select>
          <div className="flex gap-2">
            <button onClick={add} disabled={busy || !opId} className="flex-1 rounded-2xl bg-amber-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">Vincular</button>
            <button onClick={() => setAdding(false)} className="rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-500">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
