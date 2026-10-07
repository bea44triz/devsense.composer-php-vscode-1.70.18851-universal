'use client'
import { brl, fmtCompetence, fmtDate, maskCpf } from '@/lib/erp/ops'
import type { PayableRow } from '@/lib/erp/ops-data'
import { Pill, type Tone } from './ui'

export const PAYABLE_STATUS: Record<string, { label: string; tone: Tone }> = {
  pendente_validacao: { label: 'Pendente de validação', tone: 'warning' },
  a_pagar:            { label: 'A pagar',               tone: 'info' },
  aprovado:           { label: 'Aprovado',              tone: 'info' },
  agendado:           { label: 'Agendado',              tone: 'info' },
  pago:               { label: 'Pago',                  tone: 'success' },
  cancelado:          { label: 'Cancelado',             tone: 'muted' },
}
const ORIGIN: Record<string, string> = { EVENTO: 'Freelancer · evento', PONTO_FIXO: 'Ponto fixo', FORNECEDOR: 'Fornecedor', MANUAL: 'Despesa manual' }
const PIX: Record<string, string> = { cpf: 'CPF', cnpj: 'CNPJ', celular: 'Celular', email: 'E-mail', aleatoria: 'Aleatória' }

export function fmtDoc(d: string | null) {
  if (!d) return '—'
  if (d.length === 11) return maskCpf(d)
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return d
}

/** Colunas que o financeiro precisa — tudo vindo da operação, nada redigitado. */
export function PayablesTable({ rows, companyName }: { rows: PayableRow[]; companyName?: (id: string) => string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-3">Nome completo</th><th className="px-3 py-3">CPF/CNPJ</th><th className="px-3 py-3">Tipo PIX</th>
              <th className="px-3 py-3">Chave PIX</th><th className="px-3 py-3 text-right">Valor</th>
              {companyName && <th className="px-3 py-3">Empresa</th>}
              <th className="px-3 py-3">Código</th><th className="px-3 py-3">Operação</th><th className="px-3 py-3">Data</th>
              <th className="px-3 py-3">Centro de custo</th><th className="px-3 py-3">Origem</th><th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => {
              const st = PAYABLE_STATUS[p.status] ?? { label: p.status, tone: 'muted' as Tone }
              return (
                <tr key={p.id} className="align-top">
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{p.payee_name ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">{fmtDoc(p.payee_document)}</td>
                  <td className="px-3 py-2.5 text-slate-500">{p.pix_type ? PIX[p.pix_type] ?? p.pix_type : '—'}</td>
                  <td className="max-w-[220px] break-all px-3 py-2.5 font-mono text-xs">{p.pix_key ?? <span className="font-sans font-semibold text-red-600">sem PIX</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-black tabular-nums">{brl(p.amount)}</td>
                  {companyName && <td className="px-3 py-2.5">{companyName(p.company_id)}</td>}
                  <td className="px-3 py-2.5 font-mono text-xs">{p.op_code ?? '—'}</td>
                  <td className="px-3 py-2.5">{p.op_name ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{p.ref_date ? fmtDate(p.ref_date) : p.competence ? fmtCompetence(p.competence) : '—'}</td>
                  <td className="px-3 py-2.5">{p.cost_center ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-500">{ORIGIN[p.origin] ?? p.origin}</td>
                  <td className="px-3 py-2.5"><Pill tone={st.tone}>{st.label}</Pill></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
