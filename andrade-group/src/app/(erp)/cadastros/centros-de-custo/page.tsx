'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { fetchCentros, type CentroCusto } from '@/lib/erp/registry-data'
import { CentroModal } from '@/components/erp/registry-ui'
import { EmptyState, ErrorBox, Pill, Spinner } from '@/components/erp/ui'

const ORIGEM: Record<CentroCusto['origem'], string> = { interno: 'Interno', conta_azul: 'Conta Azul', importacao: 'Importação' }

export default function CentrosPage() {
  const s = useScope()
  const list = useLoad(() => fetchCentros(s.ids), `cc:${s.ids.join(',')}`)
  const [edit, setEdit] = useState<CentroCusto | 'novo' | null>(null)
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Centros de Custo</h1>
          <p className="text-sm text-slate-400">Por empresa. Usados em eventos, pontos fixos e contas a pagar.</p>
        </div>
        {s.canRegistry && <button onClick={() => setEdit('novo')} className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />Novo centro de custo</button>}
      </div>
      {list.error && <ErrorBox>{list.error}</ErrorBox>}
      {list.loading ? <Spinner /> : (list.data ?? []).length === 0 ? <EmptyState title="Nenhum centro de custo cadastrado" /> : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(list.data ?? []).map((c) => (
                <tr key={c.id} onClick={() => s.canRegistry && setEdit(c)} className={s.canRegistry ? 'cursor-pointer hover:bg-amber-50/40' : ''}>
                  <td className="px-4 py-3 font-mono font-bold">{c.codigo}</td>
                  <td className="px-4 py-3">{c.nome}{s.consolidated && <span className="ml-2 text-xs text-slate-400">{s.companyName(c.company_id)}</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{ORIGEM[c.origem]}{c.id_externo && ` · ${c.id_externo}`}</td>
                  <td className="px-4 py-3"><Pill tone={c.status === 'ativo' ? 'success' : 'muted'}>{c.status === 'ativo' ? 'Ativo' : 'Inativo'}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && s.companyId && <CentroModal companyId={s.companyId} initial={edit === 'novo' ? undefined : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); list.reload() }} />}
    </div>
  )
}
