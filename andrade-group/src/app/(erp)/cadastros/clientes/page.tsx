'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { clienteLabel, fetchClientes, type Cliente } from '@/lib/erp/registry-data'
import { fmtDoc } from '@/components/erp/PayablesTable'
import { ClienteModal } from '@/components/erp/registry-ui'
import { EmptyState, ErrorBox, Pill, Spinner } from '@/components/erp/ui'

export default function ClientesPage() {
  const s = useScope()
  const list = useLoad(() => fetchClientes(s.ids), `cli:${s.ids.join(',')}`)
  const [edit, setEdit] = useState<Cliente | 'novo' | null>(null)
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-400">Contratantes de eventos e pontos fixos desta empresa.</p>
        </div>
        {s.canRegistry && <button onClick={() => setEdit('novo')} className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />Novo cliente</button>}
      </div>
      {list.error && <ErrorBox>{list.error}</ErrorBox>}
      {list.loading ? <Spinner /> : (list.data ?? []).length === 0 ? <EmptyState title="Nenhum cliente cadastrado" /> : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(list.data ?? []).map((c) => (
            <li key={c.id}>
              <button disabled={!s.canRegistry} onClick={() => setEdit(c)} className="w-full rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-sm enabled:hover:border-amber-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-black text-slate-800">{clienteLabel(c)}</div>
                  <Pill tone={c.status === 'ativo' ? 'success' : 'muted'}>{c.status === 'ativo' ? 'Ativo' : 'Inativo'}</Pill>
                </div>
                {c.nome_fantasia && <div className="text-xs text-slate-400">{c.razao_social}</div>}
                <div className="mt-2 text-xs text-slate-500">{c.documento ? fmtDoc(c.documento) : 'Sem documento'}{c.email && ` · ${c.email}`}{s.consolidated && ` · ${s.companyName(c.company_id)}`}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {edit && s.companyId && (
        <ClienteModal companyId={s.companyId} initial={edit === 'novo' ? undefined : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); list.reload() }} />
      )}
    </div>
  )
}
