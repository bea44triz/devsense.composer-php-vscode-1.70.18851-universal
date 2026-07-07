'use client'
import { useState } from 'react'
import { AppShell }   from '@/components/Layout/AppShell'
import { PageHeader } from '@/components/Layout/PageHeader'
import { Card, CardSection } from '@/components/ui/Card'
import { Input }   from '@/components/ui/Input'
import { Button }  from '@/components/ui/Button'
import {
  CheckCircle2, Copy, CalendarDays, Clock,
  MapPin, DollarSign, AlignLeft, Search, Users,
} from 'lucide-react'
import { EquipeNome, TipoVaga } from '@/types'

const EQUIPES: { key: EquipeNome; label: string }[] = [
  { key: 'brigadistas', label: 'Brigadistas' },
  { key: 'segurancas',  label: 'Seguranças'  },
  { key: 'limpeza',     label: 'Limpeza'     },
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
const emptyVagas = (): VagasMap =>
  Object.fromEntries(EQUIPES.flatMap(e => TIPOS.map(t => [`${e.key}_${t.key}`, '0'])))
const emptyValores = (): ValoresMap => ({})

function gerarLinks(eventoId: string, vagas: VagasMap) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const links: { equipe: string; tipo: string; label: string; url: string }[] = []
  EQUIPES.forEach(e => {
    TIPOS.forEach(t => {
      const qty = Number(vagas[`${e.key}_${t.key}`] ?? 0)
      if (qty > 0) {
        links.push({
          equipe: e.key, tipo: t.key,
          label: `${e.label} — ${t.label}`,
          url: `${base}/cadastro/${eventoId}?equipe=${e.key}&tipo=${t.key}`,
        })
      }
    })
  })
  return links
}

export default function CadastrarEventosPage() {
  const [form, setForm]         = useState<BaseForm>(emptyBase)
  const [vagas, setVagas]       = useState<VagasMap>(emptyVagas())
  const [valores, setValores]   = useState<ValoresMap>(emptyValores())
  const [lat, setLat]           = useState<number | null>(null)
  const [lng, setLng]           = useState<number | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [errors, setErrors]     = useState<Record<string, string>>({})
  const [loading, setLoading]   = useState(false)
  const [eventoId, setEventoId] = useState<string | null>(null)
  const [copied, setCopied]     = useState<string | null>(null)

  const set = (f: keyof BaseForm, v: string) => {
    setForm(p => ({ ...p, [f]: v }))
    setErrors(p => { const n = { ...p }; delete n[f]; return n })
  }

  const setVaga = (equipe: EquipeNome, tipo: TipoVaga, v: string) =>
    setVagas(p => ({ ...p, [`${equipe}_${tipo}`]: v }))

  const setValor = (key: string, v: string) =>
    setValores(p => ({ ...p, [key]: v }))

  /* Combos ativas (vagas > 0) */
  const activeCombos = EQUIPES.flatMap(e =>
    TIPOS.filter(t => Number(vagas[`${e.key}_${t.key}`]) > 0)
      .map(t => ({ equipe: e, tipo: t, key: `${e.key}_${t.key}` }))
  )

  /* Busca endereço pelo nome do local via Nominatim (forward geocoding) */
  const buscarEndereco = async () => {
    const termo = form.local.trim()
    if (!termo) {
      setErrors(p => ({ ...p, local: 'Preencha o nome do local antes de buscar' }))
      return
    }
    setSearchLoading(true)
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(termo)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      )
      const data = await r.json()
      if (data[0]) {
        setLat(Number(data[0].lat))
        setLng(Number(data[0].lon))
        if (data[0].display_name) {
          setForm(p => ({ ...p, endereco: data[0].display_name }))
          setErrors(p => { const n = { ...p }; delete n.endereco; return n })
        }
      } else {
        setErrors(p => ({ ...p, endereco: 'Local não encontrado. Digite o endereço manualmente.' }))
      }
    } catch {
      setErrors(p => ({ ...p, endereco: 'Erro na busca. Digite o endereço manualmente.' }))
    }
    setSearchLoading(false)
  }

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

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const equipes = EQUIPES.flatMap(e =>
        TIPOS.map(t => ({
          equipe: e.key, tipo: t.key,
          vagas: Number(vagas[`${e.key}_${t.key}`]),
          vagasOcupadas: 0,
          valorDiaria: Number(valores[`${e.key}_${t.key}`] ?? 0),
        })).filter(x => x.vagas > 0)
      )
      const res = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, latitude: lat, longitude: lng, equipes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar evento.')
      setEventoId(data.data.id)
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

  /* ── Sucesso ── */
  if (eventoId) {
    const regLinks    = gerarLinks(eventoId, vagas)
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
              setEventoId(null); setForm(emptyBase); setVagas(emptyVagas()); setValores(emptyValores())
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

  /* ── Formulário ── */
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
                <div className="flex gap-2">
                  <input
                    placeholder="Clique em 🔍 para buscar pelo nome ou digite manualmente"
                    value={form.endereco}
                    onChange={e => set('endereco', e.target.value)}
                    className={`flex-1 rounded-2xl border px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-shadow shadow-sm ${errors.endereco ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}
                  />
                  <button type="button" onClick={buscarEndereco} disabled={searchLoading}
                    title="Buscar endereço pelo nome do local"
                    className="shrink-0 w-12 h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white flex items-center justify-center shadow-md shadow-amber-200 disabled:opacity-60 transition-all">
                    {searchLoading
                      ? <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      : <Search className="w-5 h-5" />}
                  </button>
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
                    </tr>
                  </thead>
                  <tbody>
                    {EQUIPES.map(e => (
                      <tr key={e.key}>
                        <td className="py-1.5 pl-1">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <Users className="w-3.5 h-3.5 text-amber-500" />
                            {e.label}
                          </span>
                        </td>
                        {TIPOS.map(t => (
                          <td key={t.key} className="py-1.5 px-1">
                            <input
                              type="number" min="0" inputMode="numeric"
                              value={vagas[`${e.key}_${t.key}`]}
                              onChange={ev => setVaga(e.key, t.key, ev.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-center font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardSection>
          </Card>

          {/* Pagamento — campos dinâmicos por combo ativa */}
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
