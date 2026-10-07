'use client'
import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { cn, formatPhone } from '@/lib/utils'
import { useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { brl } from '@/lib/erp/ops'
import { fetchPayables, type PayableRow } from '@/lib/erp/ops-data'
import { fmtDoc, PayablesTable, PAYABLE_STATUS } from '@/components/erp/PayablesTable'
import { EmptyState, ErrorBox, Spinner } from '@/components/erp/ui'

const FILTROS: [string, string][] = [['abertos', 'Em aberto'], ['pendente_validacao', 'Pendentes de validação'], ['pago', 'Pagos'], ['todos', 'Todos']]
const ABERTOS = ['pendente_validacao', 'a_pagar', 'aprovado', 'agendado']

// Chaves numéricas saem formatadas (pontos/traço) para o Excel não convertê-las em número e perder zeros à esquerda.
function pixForCsv(p: PayableRow) {
  if (!p.pix_key) return ''
  if (p.pix_type === 'cpf' || p.pix_type === 'cnpj') return fmtDoc(p.pix_key)
  if (p.pix_type === 'celular') return formatPhone(p.pix_key)
  return p.pix_key
}

function csv(rows: PayableRow[], companyName: (id: string) => string) {
  const head = ['NOME COMPLETO', 'CPF/CNPJ', 'PIX', 'TIPO DE CHAVE', 'VALOR', 'CODIGO EVENTO', 'NOME DO EVENTO', 'DATA', 'EMPRESA', 'CENTRO DE CUSTO', 'ORIGEM', 'STATUS']
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map((p) => [p.payee_name, fmtDoc(p.payee_document), pixForCsv(p), p.pix_type, Number(p.amount).toFixed(2).replace('.', ','),
    p.op_code, p.op_name, p.ref_date ?? p.competence, companyName(p.company_id), p.cost_center, p.origin, PAYABLE_STATUS[p.status]?.label ?? p.status].map(q).join(';'))
  return '﻿' + [head.map(q).join(';'), ...lines].join('\r\n')
}

export default function ContasAPagarPage() {
  const s = useScope()
  const pay = useLoad(() => fetchPayables(s.ids), `pay:${s.ids.join(',')}`)
  const [filtro, setFiltro] = useState('abertos')
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (pay.data ?? [])
      .filter((p) => filtro === 'todos' ? true : filtro === 'abertos' ? ABERTOS.includes(p.status) : p.status === filtro)
      .filter((p) => !term || `${p.payee_name} ${p.payee_document} ${p.op_code} ${p.op_name}`.toLowerCase().includes(term))
  }, [pay.data, filtro, q])

  const download = () => {
    const blob = new Blob([csv(rows, s.companyName)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `contas-a-pagar-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Contas a Pagar</h1>
          <p className="text-sm text-slate-400">Geradas pela operação: nome, CPF, PIX, valor e evento chegam prontos.</p>
        </div>
        <button onClick={download} disabled={rows.length === 0} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-40">
          <Download className="h-4 w-4" />Exportar CSV
        </button>
      </div>

      <div className="mb-3 flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, CPF ou evento"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
          {FILTROS.map(([k, l]) => (
            <button key={k} onClick={() => setFiltro(k)} className={cn('whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold', filtro === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>{l}</button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
        <span>{rows.length} lançamento(s)</span>
        <span>Total <b className="text-slate-800">{brl(rows.reduce((a, p) => a + Number(p.amount), 0))}</b></span>
      </div>

      {pay.error && <ErrorBox>{pay.error}</ErrorBox>}
      {pay.loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState title="Nenhum lançamento" text="Os lançamentos aparecem quando um evento é fechado e enviado ao financeiro. Se você não vê nada, confirme se tem permissão de financeiro nesta empresa." />
      ) : (
        <PayablesTable rows={rows} companyName={s.consolidated ? s.companyName : undefined} />
      )}
      <p className="mt-3 text-xs text-slate-400">Aprovação, escolha da conta bancária, agendamento e baixa chegam no Marco 3.</p>
    </div>
  )
}
