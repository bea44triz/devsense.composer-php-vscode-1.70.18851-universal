'use client'
import { useRef, useState } from 'react'
import { AppShell }   from '@/components/Layout/AppShell'
import { PageHeader } from '@/components/Layout/PageHeader'
import { Card, CardSection } from '@/components/ui/Card'
import { Input }   from '@/components/ui/Input'
import { Button }  from '@/components/ui/Button'
import {
  CheckCircle2, Copy, CalendarDays, Clock,
  MapPin, DollarSign, AlignLeft, Users, Plus, Trash2,
} from 'lucide-react'
import { TipoVaga } from '@/types'
import { criarEvento } from '@/app/actions/eventos'
import { makeSlug } from '@/lib/utils'

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
}

// ── Static types / constants ────────────────────────────────────────────────

interface EquipeItem {
  key:       string
  label:     string
  removable: boolean
}

const DEFAULT_EQUIPES: EquipeItem[] = [
  { key: 'brigadistas', label: 'Brigadistas', removable: false },
  { key: 'segurancas',  label: 'Seguranças',  removable: false },
  { key: 'limpeza',     label: 'Limpeza',     removable: false },
]

const TIPOS: { key: TipoVaga; label: string }[] = [
  { key: 'coordenador', label: 'Coordenador' },
  { key: 'freelancer',  label: 'Freelancer'  },
]

type VagasMap   = Record<string, string>
type ValoresMap = Record<string, string>

interface BaseForm {
  titulo: string; descricao: string; data: string
  horaInicio: string; horaFim: string; local: string; endereco: string
}
const emptyBase: BaseForm = {
  titulo: '', descricao: '', data: '', horaInicio: '',
  horaFim: '', local: '', endereco: '',
}
const emptyVagasFor = (items: EquipeItem[]): VagasMap =>
  Object.fromEntries(items.flatMap(e => TIPOS.map(t => [`${e.key}_${t.key}`, '0'])))

// ── Link generator ───────────────────────────────────────────────────────────

function gerarLinks(eventoId: string, vagas: VagasMap, equipes: EquipeItem[]) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const links: { equipe: string; tipo: string; label: string; url: string }[] = []
  equipes.forEach(e => {
    TIPOS.forEach(t => {
      if (Number(vagas[`${e.key}_${t.key}`] ?? 0) > 0) {
        links.push({
          equipe: e.key, tipo: t.key,
          label:  `${e.label} — ${t.label}`,
          url:    `${base}/cadastro/${eventoId}?equipe=${encodeURIComponent(e.key)}&tipo=${encodeURIComponent(t.key)}`,
        })
      }
    })
  })
  return links
}

// ────────────────────────────────────────────────────────────────────────────

export default function CadastrarEventosPage() {
  const [form, setForm]               = useState<BaseForm>(emptyBase)
  const [equipeItems, setEquipeItems] = useState<EquipeItem[]>(DEFAULT_EQUIPES)
  const [vagas, setVagas]             = useState<VagasMap>(emptyVagasFor(DEFAULT_EQUIPES))
  const [valores, setValores]         = useState<ValoresMap>({})
  const [novaEquipe, setNovaEquipe]   = useState('')
  const [erroEquipe, setErroEquipe]   = useState<string | null>(null)
  const [lat, setLat]                 = useState<number | null>(null)
  const [lng, setLng]                 = useState<number | null>(null)
  const [sugestoes, setSugestoes]     = useState<NominatimResult[]>([])
  const [showSug, setShowSug]         = useState(false)
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [errors, setErrors]           = useState<Record<string, string>>({})
  const [loading, setLoading]         = useState(false)
  const [eventoId, setEventoId]       = useState<string | null>(null)
  const [copied, setCopied]           = useState<string | null>(null)

  const set = (f: keyof BaseForm, v: string) => {
    setForm(p => ({ ...p, [f]: v }))
    setErrors(p => { const n = { ...p }; delete n[f]; return n })
  }

  const setVaga = (equipeKey: string, tipo: TipoVaga, v: string) =>
    setVagas(p => ({ ...p, [`${equipeKey}_${tipo}`]: v }))

  const setValor = (key: string, v: string) =>
    setValores(p => ({ ...p, [key]: v }))

  // ── Dynamic equipes ─────────────────────────────────────────────────────────

  const adicionarEquipe = () => {
    const label = novaEquipe.trim()
    if (!label) { setErroEquipe('Informe o nome da equipe.'); return }
    const key = makeSlug(label)
    if (!key) { setErroEquipe('Nome inválido.'); return }
    if (equipeItems.some(e => e.key === key)) { setErroEquipe('Equipe já existe.'); return }

    const newItem: EquipeItem = { key, label, removable: true }
    setEquipeItems(prev => [...prev, newItem])
    setVagas(prev => ({
      ...prev,
      ...Object.fromEntries(TIPOS.map(t => [`${key}_${t.key}`, '0'])),
    }))
    setNovaEquipe('')
    setErroEquipe(null)
  }

  const removerEquipe = (key: string) => {
    setEquipeItems(prev => prev.filter(e => e.key !== key))
    setVagas(prev => {
      const n = { ...prev }
      TIPOS.forEach(t => delete n[`${key}_${t.key}`])
      return n
    })
    setValores(prev => {
      const n = { ...prev }
      TIPOS.forEach(t => delete n[`${key}_${t.key}`])
      return n
    })
  }

  // ── Active combos (vagas > 0) ────────────────────────────────────────────────

  const activeCombos = equipeItems.flatMap(e =>
    TIPOS.filter(t => Number(vagas[`${e.key}_${t.key}`]) > 0)
      .map(t => ({ equipe: e, tipo: t, key: `${e.key}_${t.key}` }))
  )

  // ── Address autocomplete ─────────────────────────────────────────────────────

  const onEnderecoChange = (v: string) => {
    set('endereco', v)
    setLat(null); setLng(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.length < 3) { setSugestoes([]); setShowSug(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(v)}&format=json&limit=5`,
          { headers: { 'Accept-Language': 'pt-BR' } }
        )
        const data: NominatimResult[] = await r.json()
        setSugestoes(data)
        setShowSug(data.length > 0)
      } catch { /* ignore */ }
    }, 400)
  }

  const selecionarSugestao = (s: NominatimResult) => {
    setForm(p => ({ ...p, endereco: s.display_name }))
    setLat(Number(s.lat)); setLng(Number(s.lon))
    setSugestoes([]); setShowSug(false)
    setErrors(p => { const n = { ...p }; delete n.endereco; return n })
  }

  // ── Validation ───────────────────────────────────────────────────────────────

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.titulo.trim())    e.titulo     = 'Obrigatório'
    if (!form.data)             e.data       = 'Obrigatório'
    if (!form.horaInicio)       e.horaInicio = 'Obrigatório'
    if (!form.horaFim)          e.horaFim    = 'Obrigatório'
    if (!form.local.trim())     e.local      = 'Obrigatório'
    if (!form.endereco.trim())  e.endereco   = 'Obrigatório'
    if (activeCombos.length === 0) e.vagas   = 'Informe ao menos uma equipe com vagas'
    activeCombos.forEach(({ key, equipe, tipo }) => {
      if (!valores[key] || Number(valores[key]) <= 0) {
        e[`valor_${key}`] = `Informe o valor da diária para ${equipe.label} / ${tipo.label}`
      }
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const equipesPayload = equipeItems.flatMap(e =>
        TIPOS.map(t => ({
          equipe:       e.key,
          label:        e.label,
          tipo:         t.key,
          vagas:        Number(vagas[`${e.key}_${t.key}`]),
          vagasOcupadas: 0,
          valorDiaria:  Number(valores[`${e.key}_${t.key}`] ?? 0),
        })).filter(x => x.vagas > 0)
      )
      const result = await criarEvento({ ...form, latitude: lat, longitude: lng, equipes: equipesPayload })
      if (!result.success) throw new Error(result.error)
      setEventoId(result.data.id)
    } catch (err) {
      setErrors({ titulo: err instanceof Error ? err.message : 'Erro inesperado.' })
    } finally {
      setLoading(false)
    }
  }

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key); setTimeout(() => setCopied(null), 2000)
  }

  // ── Success screen ───────────────────────────────────────────────────────────

  if (eventoId) {
    const regLinks    = gerarLinks(eventoId, vagas, equipeItems)
    const origin      = typeof window !== 'undefined' ? window.location.origin : ''
    const checkinUrl  = `${origin}/checkin/${eventoId}`
    const checkoutUrl = `${origin}/checkout/${eventoId}`

    return (
      <AppShell>
        <PageHeader title="Evento criado!" backHref="/" />
        <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-4 animate-slide-up">
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-500" />
            </div>
            <h2 className="text-xl font-black text-slate-800">Evento publicado!</h2>
            <p className="text-slate-500 text-xs">Copie os links abaixo e envie para as equipes</p>
          </div>

          <Card>
            <CardSection title="Links de Cadastro por Equipe">
              <div className="space-y-2">
                {regLinks.map(l => (
                  <div key={`${l.equipe}_${l.tipo}`}
                    className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700">{l.label}</p>
                      <p className="text-[10px] text-slate-400 truncate">{l.url}</p>
                    </div>
                    <button onClick={() => copy(l.url, `${l.equipe}_${l.tipo}`)}
                      className="shrink-0 text-amber-600 hover:text-amber-700 transition-colors">
                      {copied === `${l.equipe}_${l.tipo}`
                        ? <span className="text-[10px] font-bold text-emerald-600">Copiado!</span>
                        : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </CardSection>
          </Card>

          <Card>
            <CardSection title="Links de Presença">
              {[
                { label: 'Check-in',  url: checkinUrl,  key: 'checkin'  },
                { label: 'Check-out', url: checkoutUrl, key: 'checkout' },
              ].map(l => (
                <div key={l.key} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700">{l.label}</p>
                    <p className="text-[10px] text-slate-400 truncate">{l.url}</p>
                  </div>
                  <button onClick={() => copy(l.url, l.key)}
                    className="shrink-0 text-amber-600 hover:text-amber-700 transition-colors">
                    {copied === l.key
                      ? <span className="text-[10px] font-bold text-emerald-600">Copiado!</span>
                      : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </CardSection>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => {
              setEventoId(null)
              setForm(emptyBase)
              setEquipeItems(DEFAULT_EQUIPES)
              setVagas(emptyVagasFor(DEFAULT_EQUIPES))
              setValores({})
              setNovaEquipe('')
            }}>
              Novo evento
            </Button>
            <Button variant="secondary" className="flex-1"
              onClick={() => window.location.href = `/gerenciador/eventos/${eventoId}`}>
              Ver evento
            </Button>
          </div>
        </main>
      </AppShell>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <PageHeader title="Criar Evento" subtitle="Área administrativa" backHref="/" />
      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

          <Card>
            <CardSection title="Informações">
              <Input label="Título do evento" placeholder="Ex: Evento Corporativo ABC"
                value={form.titulo} onChange={e => set('titulo', e.target.value)}
                error={errors.titulo} />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <AlignLeft className="w-3.5 h-3.5" /> Descrição
                </label>
                <textarea placeholder="Descreva o evento, requisitos, dress code…"
                  value={form.descricao} onChange={e => set('descricao', e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-shadow shadow-sm resize-none" />
              </div>
            </CardSection>
          </Card>

          <Card>
            <CardSection title="Data e horário">
              <Input label="Data" type="date" value={form.data}
                onChange={e => set('data', e.target.value)} error={errors.data}
                icon={<CalendarDays className="w-4 h-4" />} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Início" type="time" value={form.horaInicio}
                  onChange={e => set('horaInicio', e.target.value)} error={errors.horaInicio}
                  icon={<Clock className="w-4 h-4" />} />
                <Input label="Término" type="time" value={form.horaFim}
                  onChange={e => set('horaFim', e.target.value)} error={errors.horaFim}
                  icon={<Clock className="w-4 h-4" />} />
              </div>
            </CardSection>
          </Card>

          <Card>
            <CardSection title="Local">
              <Input label="Nome do local" placeholder="Ex: Estádio Mané Garrincha"
                value={form.local} onChange={e => set('local', e.target.value)}
                error={errors.local} icon={<MapPin className="w-4 h-4" />} />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Endereço
                </label>
                <div className="relative">
                  <input
                    placeholder="Digite o endereço e selecione na lista"
                    value={form.endereco}
                    onChange={e => onEnderecoChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowSug(false), 200)}
                    onFocus={() => sugestoes.length > 0 && setShowSug(true)}
                    autoComplete="off"
                    className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-shadow shadow-sm ${errors.endereco ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}
                  />
                  {showSug && sugestoes.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                      {sugestoes.map((s, i) => (
                        <button
                          key={i} type="button"
                          onMouseDown={() => selecionarSugestao(s)}
                          className="w-full text-left px-4 py-3 text-xs text-slate-700 hover:bg-amber-50 border-b border-slate-50 last:border-0 flex items-start gap-2"
                        >
                          <MapPin className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{s.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.endereco && <p className="text-xs text-red-500">⚠ {errors.endereco}</p>}
                {lat && lng && (
                  <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer"
                    className="text-xs text-amber-600 hover:underline flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" /> Ver no Google Maps
                  </a>
                )}
              </div>
            </CardSection>
          </Card>

          {/* Equipes + vagas */}
          <Card>
            <CardSection title="Equipes e vagas">
              <p className="text-xs text-slate-400 -mt-1 mb-2">
                Informe quantas vagas por equipe e tipo. Deixe 0 para não gerar link.
              </p>
              {errors.vagas && <p className="text-xs text-red-500 mb-2">⚠ {errors.vagas}</p>}

              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[260px]">
                  <thead>
                    <tr>
                      <th className="text-left pb-2 text-xs text-slate-400 font-semibold pl-1">Equipe</th>
                      {TIPOS.map(t => (
                        <th key={t.key} className="pb-2 text-xs text-slate-400 font-semibold text-center w-28">{t.label}</th>
                      ))}
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {equipeItems.map(e => (
                      <tr key={e.key}>
                        <td className="py-1.5 pl-1">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            {e.label}
                          </span>
                        </td>
                        {TIPOS.map(t => (
                          <td key={t.key} className="py-1.5 px-1">
                            <input
                              type="number" min="0" inputMode="numeric"
                              value={vagas[`${e.key}_${t.key}`] ?? '0'}
                              onChange={ev => setVaga(e.key, t.key, ev.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-center font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm"
                            />
                          </td>
                        ))}
                        <td className="py-1.5 pl-1">
                          {e.removable && (
                            <button
                              type="button"
                              onClick={() => removerEquipe(e.key)}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                              aria-label={`Remover ${e.label}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add new team */}
              <div className="mt-3 flex gap-2 items-start">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Nome da nova equipe"
                    value={novaEquipe}
                    onChange={e => { setNovaEquipe(e.target.value); setErroEquipe(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarEquipe() } }}
                    className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm ${erroEquipe ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}
                  />
                  {erroEquipe && <p className="text-xs text-red-500 mt-1">⚠ {erroEquipe}</p>}
                </div>
                <button
                  type="button"
                  onClick={adicionarEquipe}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar equipe
                </button>
              </div>
            </CardSection>
          </Card>

          {/* Payment — dynamic per active combo */}
          {activeCombos.length > 0 && (
            <Card>
              <CardSection title="Pagamento">
                <p className="text-xs text-slate-400 -mt-1 mb-3">
                  Informe o valor da diária para cada equipe e tipo com vagas ativas.
                </p>
                <div className="space-y-3">
                  {activeCombos.map(({ equipe, tipo, key }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                        Diária — {equipe.label} / {tipo.label}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                        <input
                          type="number" min="0" step="0.01" inputMode="decimal"
                          placeholder="0,00"
                          value={valores[key] ?? ''}
                          onChange={ev => setValor(key, ev.target.value)}
                          className={`w-full rounded-2xl border pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-shadow shadow-sm ${errors[`valor_${key}`] ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}
                        />
                      </div>
                      {errors[`valor_${key}`] && (
                        <p className="text-xs text-red-500">⚠ {errors[`valor_${key}`]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardSection>
            </Card>
          )}

          <Button type="submit" size="lg" loading={loading}>
            Publicar Evento
          </Button>
        </form>
      </main>
    </AppShell>
  )
}
