'use client'
import { useState } from 'react'
import { Plus, Search, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { fetchFornecedores, fornecedorPix, saveFornecedor, type Fornecedor } from '@/lib/erp/registry-data'
import { fmtDoc } from '@/components/erp/PayablesTable'
import { F, field } from '@/components/erp/registry-ui'
import { EmptyState, ErrorBox, Modal, Pill, Spinner } from '@/components/erp/ui'

const PIX = [['cnpj', 'CNPJ'], ['cpf', 'CPF'], ['celular', 'Celular'], ['email', 'E-mail'], ['aleatoria', 'Aleatória']] as const

export default function FornecedoresPage() {
  const s = useScope()
  const list = useLoad(() => fetchFornecedores(s.ids), `forn:${s.ids.join(',')}`)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Fornecedor | 'novo' | null>(null)
  const rows = (list.data ?? []).filter((f) => !q || `${f.razao_social} ${f.nome_fantasia ?? ''} ${f.servico ?? ''} ${f.documento ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Fornecedores</h1>
          <p className="text-sm text-slate-400">Empresas e prestadores (diferente dos profissionais/freelancers).</p>
        </div>
        {s.canRegistry && <button onClick={() => setEdit('novo')} className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />Novo fornecedor</button>}
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, serviço ou documento" className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      {list.error && <ErrorBox>{list.error}</ErrorBox>}
      {list.loading ? <Spinner /> : rows.length === 0 ? <EmptyState title="Nenhum fornecedor" /> : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((f) => (
            <li key={f.id}>
              <button disabled={!s.canRegistry} onClick={() => setEdit(f)} className="w-full rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-sm enabled:hover:border-amber-200">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-amber-400"><Truck className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate font-black text-slate-800">{f.nome_fantasia || f.razao_social}</div>
                      <Pill tone={f.status === 'ativo' ? 'success' : 'muted'}>{f.status === 'ativo' ? 'Ativo' : 'Inativo'}</Pill>
                    </div>
                    <div className="truncate text-xs text-slate-400">{f.servico ?? 'Serviço não informado'}{s.consolidated && ` · ${s.companyName(f.company_id)}`}</div>
                    <div className="mt-1.5 text-xs text-slate-500">{f.documento ? fmtDoc(f.documento) : 'Sem documento'} · PIX {f.has_pix ? f.pix_key_masked : <span className="font-semibold text-red-600">não cadastrado</span>}</div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {edit && s.companyId && <FornecedorModal companyId={s.companyId} initial={edit === 'novo' ? undefined : edit} showPix={s.canSeeFinanceData} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); list.reload() }} />}
    </div>
  )
}

function FornecedorModal({ companyId, initial, showPix, onClose, onSaved }: { companyId: string; initial?: Fornecedor; showPix: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    razao_social: initial?.razao_social ?? '', nome_fantasia: initial?.nome_fantasia ?? '', documento: initial?.documento ?? '',
    telefone: initial?.telefone ?? '', email: initial?.email ?? '', servico: initial?.servico ?? '', status: initial?.status ?? 'ativo',
    pix_type: initial?.pix_type ?? 'cnpj', pix_key: '',
  })
  const [currentPix, setCurrentPix] = useState<string | null>(initial?.pix_key_masked ?? null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const reveal = async () => { if (initial) setCurrentPix((await fornecedorPix(initial.id))?.pix_key ?? null) }
  const save = async () => {
    if (!f.razao_social.trim()) return setErr('Informe a razão social / nome.')
    setBusy(true); setErr(null)
    try {
      // a chave só vai ao banco se o usuário digitou uma nova; vazio = manter a atual
      const { pix_key, pix_type, ...rest } = f
      await saveFornecedor({ id: initial?.id, company_id: companyId, ...rest, status: rest.status as 'ativo' | 'inativo',
        ...(pix_key.trim() ? { pix_key: pix_key.trim(), pix_type } : {}) })
      onSaved()
    } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }
  return (
    <Modal open onClose={onClose} title={initial ? 'Editar fornecedor' : 'Novo fornecedor'}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">
        {err && <ErrorBox>{err}</ErrorBox>}
        <F label="Razão social / nome"><input className={field} value={f.razao_social} onChange={(e) => setF({ ...f, razao_social: e.target.value })} /></F>
        <F label="Nome fantasia"><input className={field} value={f.nome_fantasia} onChange={(e) => setF({ ...f, nome_fantasia: e.target.value })} /></F>
        <div className="grid grid-cols-2 gap-2">
          <F label="CPF/CNPJ"><input className={field} inputMode="numeric" value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} /></F>
          <F label="Serviço"><input className={field} value={f.servico} onChange={(e) => setF({ ...f, servico: e.target.value })} placeholder="Buffet, transporte…" /></F>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <F label="Telefone"><input className={field} inputMode="tel" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></F>
          <F label="E-mail"><input className={field} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></F>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase text-slate-500">PIX atual: <span className="font-mono normal-case text-slate-700">{currentPix ?? 'não cadastrado'}</span>
            {initial?.has_pix && showPix && currentPix?.includes('•') && <button type="button" onClick={reveal} className="ml-2 font-bold text-amber-600">mostrar</button>}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{PIX.map(([v, l]) => (
            <button key={v} type="button" onClick={() => setF({ ...f, pix_type: v, pix_key: '' })} className={cn('rounded-xl border px-2.5 py-1 text-xs font-bold', f.pix_type === v ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 bg-white text-slate-600')}>{l}</button>
          ))}</div>
          <input className={cn(field, 'mt-2')} placeholder={initial?.has_pix ? 'Nova chave (deixe vazio para manter)' : 'Chave PIX'} value={f.pix_key} onChange={(e) => setF({ ...f, pix_key: e.target.value })} aria-label="Chave PIX" />
        </div>
        {initial && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-amber-500" checked={f.status === 'ativo'} onChange={(e) => setF({ ...f, status: e.target.checked ? 'ativo' : 'inativo' })} />Ativo</label>}
        <button onClick={save} disabled={busy} className="w-full rounded-2xl bg-amber-500 py-3 font-bold text-white disabled:opacity-50">Salvar fornecedor</button>
      </div>
    </Modal>
  )
}
