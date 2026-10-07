'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Briefcase, Search } from 'lucide-react'
import { formatPhone } from '@/lib/utils'
import { useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { cpfHidden } from '@/lib/erp/ops'
import { fetchPeople, type PersonListRow } from '@/lib/erp/people-data'
import { EmptyState, ErrorBox, Pill, Spinner } from '@/components/erp/ui'

function funcoes(p: PersonListRow): string[] {
  const set = new Set<string>()
  if (p.main_role) set.add(p.main_role)
  for (const ep of p.event_participants) if (ep.event_teams?.name) set.add(ep.event_teams.name)
  return [...set].slice(0, 3)
}

export default function PessoasPage() {
  const s = useScope()
  const list = useLoad(() => fetchPeople(s.ids), `ppl:${s.ids.join(',')}`)
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase(); const d = t.replace(/\D/g, '')
    return (list.data ?? []).filter((p) => !t || p.full_name.toLowerCase().includes(t) || (d.length >= 3 && p.cpf.includes(d)))
  }, [list.data, q])
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-black text-slate-900">Pessoas / Freelancers</h1>
        <p className="text-sm text-slate-400">Base central de profissionais. Um cadastro por CPF em cada empresa.</p>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou CPF"
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      {list.error && <ErrorBox>{list.error}</ErrorBox>}
      {list.loading ? <Spinner /> : rows.length === 0 ? <EmptyState title="Nenhum profissional encontrado" text="Profissionais entram pelo link de inscrição dos eventos ou pela alocação em pontos fixos." /> : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          {rows.map((p) => {
            const eventos = p.event_participants.filter((e) => e.status === 'confirmado').length
            const ponto = p.fixed_post_members.find((m) => m.status === 'ativo')?.fixed_posts?.name
            return (
              <li key={p.id}>
                <Link href={`/pessoas/${p.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-amber-50/40">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-600">
                    {p.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-slate-800">{p.full_name}</div>
                    <div className="text-xs text-slate-400">CPF {cpfHidden(p.cpf)}{p.phone && ` · ${formatPhone(p.phone)}`}{s.consolidated && ` · ${s.companyName(p.company_id)}`}</div>
                    <div className="mt-1 flex flex-wrap gap-1">{funcoes(p).map((f) => <span key={f} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{f}</span>)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs">
                    <Pill tone={p.status === 'ativo' ? 'success' : p.status === 'bloqueado' ? 'danger' : 'muted'}>{p.status === 'ativo' ? 'Ativo' : p.status === 'bloqueado' ? 'Bloqueado' : 'Inativo'}</Pill>
                    <span className="font-semibold text-slate-500">{eventos} evento{eventos !== 1 ? 's' : ''}</span>
                    {ponto && <span className="flex items-center gap-1 font-semibold text-amber-700"><Briefcase className="h-3 w-3" />{ponto}</span>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
