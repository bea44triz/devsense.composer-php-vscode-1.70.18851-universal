'use client'
import { useState } from 'react'
import { AppShell } from '@/components/Layout/AppShell'
import { PageHeader } from '@/components/Layout/PageHeader'
import { Card, CardSection } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CheckCircle2, Copy, CalendarDays, Clock, MapPin, Users, DollarSign, AlignLeft } from 'lucide-react'

interface EForm {
  titulo: string; descricao: string; data: string
  horaInicio: string; horaFim: string; local: string
  endereco: string; vagasTotal: string; valorHora: string
}
const empty: EForm = { titulo:'', descricao:'', data:'', horaInicio:'', horaFim:'', local:'', endereco:'', vagasTotal:'', valorHora:'' }

export default function CadastrarEventosPage() {
  const [form, setForm]       = useState<EForm>(empty)
  const [errors, setErrors]   = useState<Partial<Record<keyof EForm, string>>>({})
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [eventoId, setEventoId] = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)

  const set = (f: keyof EForm, v: string) => {
    setForm(p => ({ ...p, [f]: v }))
    setErrors(p => ({ ...p, [f]: undefined }))
  }

  const validate = () => {
    const e: Partial<Record<keyof EForm, string>> = {}
    if (!form.titulo.trim())                         e.titulo     = 'Título obrigatório'
    if (!form.data)                                  e.data       = 'Data obrigatória'
    if (!form.horaInicio)                            e.horaInicio = 'Hora de início obrigatória'
    if (!form.horaFim)                               e.horaFim   = 'Hora de término obrigatória'
    if (!form.local.trim())                          e.local     = 'Local obrigatório'
    if (!form.endereco.trim())                       e.endereco  = 'Endereço obrigatório'
    if (!form.vagasTotal || Number(form.vagasTotal) < 1) e.vagasTotal = 'Vagas inválidas'
    if (!form.valorHora  || Number(form.valorHora)  <= 0) e.valorHora = 'Valor inválido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res  = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, vagasTotal: Number(form.vagasTotal), valorHora: Number(form.valorHora) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar evento.')
      setEventoId(data.data.id)
      setSucesso(true)
    } catch (err) {
      setErrors({ titulo: err instanceof Error ? err.message : 'Erro inesperado.' })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!eventoId) return
    await navigator.clipboard.writeText(eventoId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /* ── Sucesso ── */
  if (sucesso && eventoId) {
    return (
      <AppShell>
        <PageHeader title="Evento criado" backHref="/" />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5 py-10 text-center animate-slide-up">
          <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800">Evento publicado!</h2>
            <p className="text-slate-500 text-sm mt-1">Compartilhe o ID com os freelancers.</p>
          </div>

          <Card className="w-full max-w-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">ID do Evento</p>
            <p className="font-mono text-sm font-bold text-slate-800 break-all bg-slate-50 rounded-xl px-3 py-2">{eventoId}</p>
            <button onClick={handleCopy}
              className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 hover:underline font-semibold mx-auto">
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copiado!' : 'Copiar ID'}
            </button>
          </Card>

          <div className="flex gap-3 w-full max-w-sm">
            <Button variant="outline" className="flex-1" onClick={() => { setSucesso(false); setForm(empty) }}>
              Novo evento
            </Button>
            <Button className="flex-1" onClick={() => window.location.href = `/eventos/${eventoId}`}>
              Ver evento
            </Button>
          </div>
        </div>
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
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <AlignLeft className="w-3.5 h-3.5" /> Descrição
                </label>
                <textarea
                  placeholder="Descreva o evento, requisitos, dress code…"
                  value={form.descricao}
                  onChange={e => set('descricao', e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-shadow shadow-sm resize-none hover:border-slate-300"
                />
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
              <Input label="Nome do local" placeholder="Ex: Hotel Maksoud Plaza"
                value={form.local} onChange={e => set('local', e.target.value)}
                error={errors.local} icon={<MapPin className="w-4 h-4" />} />
              <Input label="Endereço completo" placeholder="Rua, número, bairro, cidade"
                value={form.endereco} onChange={e => set('endereco', e.target.value)}
                error={errors.endereco} />
            </CardSection>
          </Card>

          <Card>
            <CardSection title="Vagas e pagamento">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nº de vagas" type="number" min="1" placeholder="10"
                  value={form.vagasTotal} onChange={e => set('vagasTotal', e.target.value)}
                  error={errors.vagasTotal} inputMode="numeric"
                  icon={<Users className="w-4 h-4" />} />
                <Input label="Valor/hora (R$)" type="number" min="0" step="0.01" placeholder="25,00"
                  value={form.valorHora} onChange={e => set('valorHora', e.target.value)}
                  error={errors.valorHora} inputMode="decimal"
                  icon={<DollarSign className="w-4 h-4" />} />
              </div>
            </CardSection>
          </Card>

          <Button type="submit" size="lg" loading={loading}>
            Publicar Evento
          </Button>
        </form>
      </main>
    </AppShell>
  )
}
