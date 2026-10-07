'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEnvironment, useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { createFixedPost, SUBCATEGORIES } from '@/lib/erp/fixed-data'
import { fetchAssignableUsers } from '@/lib/erp/ops-data'
import { CentroSelect, ClienteSelect, F, field } from '@/components/erp/registry-ui'
import { ErrorBox } from '@/components/erp/ui'

export default function NovoPontoFixoPage() {
  const s = useScope()
  const { userId } = useEnvironment()
  const router = useRouter()
  const users = useLoad(() => (s.companyId && s.canSeeAll ? fetchAssignableUsers(s.companyId) : Promise.resolve([])), `au:${s.companyId}:${s.canSeeAll}`)
  const [f, setF] = useState({
    code: '', name: '', cliente_evento_id: '', centro_custo_id: '', location: '', address: '',
    category: '', subcategory: '', responsavel_user_id: '', start_date: '', notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!s.canOperate || !s.companyId) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">Para criar pontos fixos, selecione uma empresa em que você tenha permissão de gerenciar a operação.</div>
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  const save = async () => {
    setErr(null)
    if (!f.code.trim() || !f.name.trim()) return setErr('Informe código e nome do ponto fixo.')
    if (!f.cliente_evento_id) return setErr('Selecione o cliente.')
    if (!f.centro_custo_id) return setErr('Selecione o centro de custo.')
    setBusy(true)
    try {
      const id = await createFixedPost(s.companyId!, { ...f, responsavel_user_id: f.responsavel_user_id || null })
      router.push(`/pontos-fixos/${id}?criado=1`)
    } catch (x) { setErr((x as Error).message); setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <button onClick={() => router.push('/pontos-fixos')} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-400 hover:text-slate-700"><ArrowLeft className="h-4 w-4" />Pontos Fixos</button>
      <h1 className="text-2xl font-black text-slate-900">Novo ponto fixo</h1>
      <p className="mb-4 text-sm text-slate-400">Depois de criar, você aloca os profissionais e abre a competência do mês.</p>
      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}
      <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
          <F label="Código *"><input className={field} value={f.code} onChange={set('code')} placeholder="PF-001" /></F>
          <F label="Nome *"><input className={field} value={f.name} onChange={set('name')} placeholder="Obra Residencial X" /></F>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ClienteSelect companyId={s.companyId} value={f.cliente_evento_id} onChange={(v) => setF({ ...f, cliente_evento_id: v })} canCreate={s.canRegistry} label="Cliente *" />
          <CentroSelect companyId={s.companyId} value={f.centro_custo_id} onChange={(v) => setF({ ...f, centro_custo_id: v })} canCreate={s.canRegistry} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Local"><input className={field} value={f.location} onChange={set('location')} placeholder="Obra Residencial X" /></F>
          <F label="Endereço"><input className={field} value={f.address} onChange={set('address')} /></F>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Categoria">
            <input className={field} list="pf-categorias" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value, subcategory: '' })} placeholder="Segurança" />
            <datalist id="pf-categorias">{Object.keys(SUBCATEGORIES).map((c) => <option key={c} value={c} />)}</datalist>
          </F>
          <F label="Subcategoria">
            <input className={field} list="pf-subcategorias" value={f.subcategory} onChange={set('subcategory')} placeholder="Segurança de Obras" />
            <datalist id="pf-subcategorias">{(SUBCATEGORIES[f.category] ?? []).map((c) => <option key={c} value={c} />)}</datalist>
          </F>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Responsável">
            {s.canSeeAll ? (
              <select className={field} value={f.responsavel_user_id} onChange={set('responsavel_user_id')}>
                <option value="">Eu mesmo</option>
                {(users.data ?? []).filter((u) => u.user_id !== userId).map((u) => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
              </select>
            ) : <div className={`${field} bg-slate-50 text-slate-500`}>Você será o responsável</div>}
          </F>
          <F label="Início da operação"><input type="date" className={field} value={f.start_date} onChange={set('start_date')} /></F>
        </div>
        <F label="Observações"><textarea className={field} rows={2} value={f.notes} onChange={set('notes')} /></F>
        <button onClick={save} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 font-bold text-white shadow-md shadow-amber-200 disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}Criar ponto fixo
        </button>
      </div>
    </div>
  )
}
