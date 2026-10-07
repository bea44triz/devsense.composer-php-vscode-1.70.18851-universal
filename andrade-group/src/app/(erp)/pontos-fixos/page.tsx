'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BriefcaseBusiness, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { fetchFixedPosts } from '@/lib/erp/fixed-data'
import { FixedPostCard } from '@/components/erp/FixedPostCard'
import { EmptyState, ErrorBox, Spinner } from '@/components/erp/ui'

export default function PontosFixosPage() {
  const s = useScope()
  const list = useLoad(() => fetchFixedPosts(s.ids), `fp:${s.ids.join(',')}`)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'ativo' | 'todos'>('ativo')
  const rows = useMemo(() => (list.data ?? [])
    .filter((p) => filtro === 'todos' || p.status === 'ativo')
    .filter((p) => !q || `${p.code} ${p.name} ${p.client_name ?? ''} ${p.location ?? ''} ${p.category ?? ''} ${p.subcategory ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  [list.data, q, filtro])
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Pontos Fixos</h1>
          <p className="text-sm text-slate-400">Postos contínuos: profissionais alocados e competência mensal.</p>
        </div>
        {s.canOperate && (
          <Link href="/pontos-fixos/novo" className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-200 hover:bg-amber-400">
            <BriefcaseBusiness className="h-4 w-4" /> Novo ponto fixo
          </Link>
        )}
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, cliente, local ou categoria"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
          {([['ativo', 'Ativos'], ['todos', 'Todos']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFiltro(k)} className={cn('rounded-xl px-3 py-2 text-xs font-bold', filtro === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>{l}</button>
          ))}
        </div>
      </div>
      {list.error && <ErrorBox>{list.error}</ErrorBox>}
      {list.loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState title="Nenhum ponto fixo" text={s.canOperate ? 'Crie o primeiro em “Novo ponto fixo”.' : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => <FixedPostCard key={p.id} p={p} companyName={s.consolidated ? s.companyName(p.company_id) : undefined} />)}
        </div>
      )}
    </div>
  )
}
