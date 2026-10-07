'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, LocateFixed, MapPin, Plus, Trash2, Users } from 'lucide-react'
import { cn, makeSlug } from '@/lib/utils'
import { getSupabase } from '@/lib/supabase/client'
import { useScope } from '@/lib/erp/environment'
import { brl, TEAM_SUGGESTIONS } from '@/lib/erp/ops'
import { ErrorBox } from '@/components/erp/ui'

interface TeamDraft { name: string; quantity: string; rate: string; coordinator_name: string; start_time: string; end_time: string }
const emptyTeam = (name = ''): TeamDraft => ({ name, quantity: '', rate: '', coordinator_name: '', start_time: '', end_time: '' })
interface Sugestao { display_name: string; lat: string; lon: string }

/** "1.234,56" → 1234.56 · "180,5" → 180.5 · "180.50" → 180.5 */
const money = (v: string) => Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v) || 0

const field = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400'
function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={cn('flex flex-col gap-1.5', className)}><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>
}

export default function NovoEventoPage() {
  const s = useScope()
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [e, setE] = useState({
    code: '', name: '', client_name: '', cost_center: '', event_date: '', start_time: '', end_time: '',
    location: '', address: '', manager_name: '', notes: '', radius_m: '300', show_rate: true,
    latitude: null as number | null, longitude: null as number | null,
  })
  const [teams, setTeams] = useState<TeamDraft[]>([])
  const [sug, setSug] = useState<Sugestao[]>([])
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!s.canOperate) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
      Para criar eventos, selecione uma empresa em que você tenha permissão de gerenciar a operação.
    </div>
  }

  const set = (k: keyof typeof e) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setE((x) => ({ ...x, [k]: ev.target.value }))
  const setTeam = (i: number, patch: Partial<TeamDraft>) => setTeams((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)))

  // autocomplete de endereço (mesma fonte do app Andrade: Nominatim/OpenStreetMap)
  const onAddress = (v: string) => {
    setE((x) => ({ ...x, address: v, latitude: null, longitude: null }))
    if (debounce.current) clearTimeout(debounce.current)
    if (v.length < 4) { setSug([]); return }
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(v)}&format=json&limit=5&countrycodes=br`, { headers: { 'Accept-Language': 'pt-BR' } })
        setSug(await r.json())
      } catch { /* sem sugestões */ }
    }, 400)
  }
  const pick = (g: Sugestao) => { setE((x) => ({ ...x, address: g.display_name, latitude: Number(g.lat), longitude: Number(g.lon) })); setSug([]) }
  const here = () => navigator.geolocation?.getCurrentPosition(
    (p) => setE((x) => ({ ...x, latitude: p.coords.latitude, longitude: p.coords.longitude })),
    () => setErr('Não foi possível obter sua localização.'), { enableHighAccuracy: true, timeout: 15000 })

  const next = () => {
    setErr(null)
    if (!e.code.trim() || !e.name.trim() || !e.event_date) return setErr('Preencha código, nome e data do evento.')
    if (teams.length === 0) setTeams([emptyTeam()])
    setStep(2)
    window.scrollTo({ top: 0 })
  }

  const addTeam = (name = '') => {
    setErr(null)
    if (name && teams.some((t) => makeSlug(t.name) === makeSlug(name))) return setErr(`${name} já foi adicionada.`)
    setTeams((ts) => [...ts.filter((t) => t.name.trim() || t.quantity), emptyTeam(name)])
  }

  const valid = teams.filter((t) => t.name.trim())
  const heads = valid.reduce((a, t) => a + (Number(t.quantity) || 0), 0)
  const total = valid.reduce((a, t) => a + (Number(t.quantity) || 0) * money(t.rate), 0)

  async function save() {
    setErr(null)
    if (valid.length === 0) return setErr('Adicione pelo menos uma equipe/função.')
    const keys = valid.map((t) => makeSlug(t.name))
    const dup = valid.find((t, i) => keys.indexOf(makeSlug(t.name)) !== i)
    if (dup) return setErr(`Equipe duplicada: ${dup.name}.`)
    const semQtd = valid.find((t) => !(Number(t.quantity) > 0))
    if (semQtd) return setErr(`Informe a quantidade de ${semQtd.name}.`)
    setBusy(true)
    const { data, error } = await getSupabase().rpc('event_create', {
      _company_id: s.companyId!,
      _event: { ...e, latitude: e.latitude ?? '', longitude: e.longitude ?? '' },
      _teams: valid.map((t) => ({ ...t, quantity: Number(t.quantity), rate: money(t.rate) })),
    })
    setBusy(false)
    if (error) return setErr(error.message)
    router.push(`/eventos/${data}?criado=1`)
  }

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <button onClick={() => (step === 2 ? setStep(1) : router.push('/eventos'))} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-400 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />{step === 2 ? 'Dados do evento' : 'Eventos'}
      </button>
      <h1 className="text-2xl font-black text-slate-900">Novo evento</h1>
      <p className="text-sm text-slate-400">{step === 1 ? 'Etapa 1 de 2 · Evento' : 'Etapa 2 de 2 · Operação'}</p>
      <div className="my-4 flex gap-2">{[1, 2].map((n) => <div key={n} className={cn('h-1.5 flex-1 rounded-full', step >= n ? 'bg-amber-500' : 'bg-slate-200')} />)}</div>

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      {step === 1 ? (
        <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
            <F label="Código *"><input className={field} value={e.code} onChange={set('code')} placeholder="EV-001" /></F>
            <F label="Nome do evento *"><input className={field} value={e.name} onChange={set('name')} placeholder="Congresso XPTO" /></F>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Cliente"><input className={field} value={e.client_name} onChange={set('client_name')} /></F>
            <F label="Centro de custo"><input className={field} value={e.cost_center} onChange={set('cost_center')} /></F>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <F label="Data *"><input type="date" className={field} value={e.event_date} onChange={set('event_date')} /></F>
            <F label="Início"><input type="time" className={field} value={e.start_time} onChange={set('start_time')} /></F>
            <F label="Fim"><input type="time" className={field} value={e.end_time} onChange={set('end_time')} /></F>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Local"><input className={field} value={e.location} onChange={set('location')} placeholder="Centro de Convenções" /></F>
            <F label="Responsável"><input className={field} value={e.manager_name} onChange={set('manager_name')} /></F>
          </div>
          <div className="relative">
            <F label="Endereço"><input className={field} value={e.address} onChange={(ev) => onAddress(ev.target.value)} placeholder="Digite para buscar" autoComplete="off" /></F>
            {sug.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
                {sug.map((g, i) => (
                  <li key={i}><button type="button" onClick={() => pick(g)} className="flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm hover:bg-amber-50">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><span className="line-clamp-2">{g.display_name}</span></button></li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className={cn('h-4 w-4', e.latitude != null ? 'text-emerald-500' : 'text-slate-400')} />
              <span className={e.latitude != null ? 'font-semibold text-emerald-700' : 'text-slate-500'}>
                {e.latitude != null ? `Localização definida (${e.latitude.toFixed(4)}, ${e.longitude?.toFixed(4)})` : 'Sem localização: a distância no check-in não será calculada.'}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <button type="button" onClick={here} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><LocateFixed className="h-3.5 w-3.5" />Estou no local</button>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">Raio (m)
                <input inputMode="numeric" className="w-20 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm" value={e.radius_m} onChange={(ev) => setE((x) => ({ ...x, radius_m: ev.target.value.replace(/\D/g, '') }))} />
              </label>
            </div>
          </div>
          <F label="Observações"><textarea className={field} rows={2} value={e.notes} onChange={set('notes')} /></F>
          <label className="flex items-center gap-3 text-sm text-slate-600">
            <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={e.show_rate} onChange={(ev) => setE((x) => ({ ...x, show_rate: ev.target.checked }))} />
            Mostrar o valor da diária no link de inscrição
          </label>
          <button onClick={next} className="w-full rounded-2xl bg-amber-500 py-3.5 text-base font-bold text-white shadow-md shadow-amber-200 hover:bg-amber-400">Próximo: operação</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-3xl bg-slate-900 p-5 text-white">
            <h2 className="text-lg font-black">O que você precisa para este evento?</h2>
            <p className="text-sm text-slate-400">Toque numa função para adicionar, ou crie uma nova.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {TEAM_SUGGESTIONS.filter((n) => !teams.some((t) => makeSlug(t.name) === makeSlug(n))).map((n) => (
                <button key={n} type="button" onClick={() => addTeam(n === 'Outros' ? '' : n)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500">+ {n}</button>
              ))}
            </div>
          </div>

          {teams.map((t, i) => (
            <div key={i} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-end gap-2">
                <F label="Equipe / função" className="flex-1"><input className={cn(field, 'font-bold uppercase')} value={t.name} onChange={(ev) => setTeam(i, { name: ev.target.value })} placeholder="Ex.: Segurança" /></F>
                <button type="button" onClick={() => setTeams((ts) => ts.filter((_, j) => j !== i))} className="mb-1 rounded-xl p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label={`Remover ${t.name || 'equipe'}`}><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <F label="Quantidade"><input inputMode="numeric" className={field} value={t.quantity} onChange={(ev) => setTeam(i, { quantity: ev.target.value.replace(/\D/g, '') })} placeholder="10" /></F>
                <F label="Valor (R$)"><input inputMode="decimal" className={field} value={t.rate} onChange={(ev) => setTeam(i, { rate: ev.target.value.replace(/[^\d,.]/g, '') })} placeholder="180" /></F>
                <F label="Coordenador" className="col-span-2 sm:col-span-1"><input className={field} value={t.coordinator_name} onChange={(ev) => setTeam(i, { coordinator_name: ev.target.value })} /></F>
                <F label="Das"><input type="time" className={field} value={t.start_time} onChange={(ev) => setTeam(i, { start_time: ev.target.value })} /></F>
                <F label="Às"><input type="time" className={field} value={t.end_time} onChange={(ev) => setTeam(i, { end_time: ev.target.value })} /></F>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => addTeam()} className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-200 py-4 text-sm font-bold text-slate-500 hover:border-amber-400 hover:text-amber-600">
            <Plus className="h-4 w-4" /> Adicionar equipe / função
          </button>

          <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom,0px))] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-72">
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              <div className="flex-1 text-sm text-slate-500">
                <div className="flex items-center gap-1.5"><Users className="h-4 w-4 text-amber-500" /><b className="text-slate-800">{heads}</b> profissionais</div>
                <div>Custo previsto <b className="text-slate-800">{brl(total)}</b></div>
              </div>
              <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-amber-200 hover:bg-amber-400 disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}Criar evento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
