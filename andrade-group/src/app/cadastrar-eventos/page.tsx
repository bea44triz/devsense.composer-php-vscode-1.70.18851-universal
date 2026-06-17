'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/Layout/PageHeader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CheckCircle2, Copy } from 'lucide-react'

interface EventoForm {
  titulo: string
  descricao: string
  data: string
  horaInicio: string
  horaFim: string
  local: string
  endereco: string
  vagasTotal: string
  valorHora: string
}

const emptyForm: EventoForm = {
  titulo: '',
  descricao: '',
  data: '',
  horaInicio: '',
  horaFim: '',
  local: '',
  endereco: '',
  vagasTotal: '',
  valorHora: '',
}

export default function CadastrarEventosPage() {
  const [form, setForm] = useState<EventoForm>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof EventoForm, string>>>({})
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [eventoId, setEventoId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const set = (field: keyof EventoForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof EventoForm, string>> = {}
    if (!form.titulo.trim()) errs.titulo = 'Título obrigatório'
    if (!form.data) errs.data = 'Data obrigatória'
    if (!form.horaInicio) errs.horaInicio = 'Hora de início obrigatória'
    if (!form.horaFim) errs.horaFim = 'Hora de fim obrigatória'
    if (!form.local.trim()) errs.local = 'Local obrigatório'
    if (!form.endereco.trim()) errs.endereco = 'Endereço obrigatório'
    if (!form.vagasTotal || Number(form.vagasTotal) < 1) errs.vagasTotal = 'Vagas inválidas'
    if (!form.valorHora || Number(form.valorHora) <= 0) errs.valorHora = 'Valor inválido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    try {
      const res = await fetch('/api/eventos', {
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

  if (sucesso && eventoId) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <PageHeader title="Evento Criado" backHref="/" />
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Evento cadastrado!</h2>
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm shadow-sm">
            <p className="text-xs text-slate-400 mb-1">ID do Evento</p>
            <p className="font-mono text-sm font-bold text-slate-800 break-all">{eventoId}</p>
            <button onClick={handleCopy}
              className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 hover:underline mx-auto">
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copiado!' : 'Copiar ID'}
            </button>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setSucesso(false); setForm(emptyForm) }}>
              Novo evento
            </Button>
            <Button onClick={() => window.location.href = `/eventos/${eventoId}`}>
              Ver evento
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <PageHeader title="Cadastrar Evento" subtitle="Área administrativa" backHref="/" />

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-700">Informações do Evento</h2>
            <Input label="Título do evento" placeholder="Ex: Evento Corporativo ABC" value={form.titulo}
              onChange={(e) => set('titulo', e.target.value)} error={errors.titulo} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Descrição</label>
              <textarea
                placeholder="Descreva o evento, requisitos, dress code…"
                value={form.descricao}
                onChange={(e) => set('descricao', e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-700">Data e Horário</h2>
            <Input label="Data" type="date" value={form.data}
              onChange={(e) => set('data', e.target.value)} error={errors.data} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Início" type="time" value={form.horaInicio}
                onChange={(e) => set('horaInicio', e.target.value)} error={errors.horaInicio} />
              <Input label="Término" type="time" value={form.horaFim}
                onChange={(e) => set('horaFim', e.target.value)} error={errors.horaFim} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-700">Local</h2>
            <Input label="Nome do local" placeholder="Ex: Hotel Maksoud Plaza" value={form.local}
              onChange={(e) => set('local', e.target.value)} error={errors.local} />
            <Input label="Endereço completo" placeholder="Rua, número, bairro, cidade" value={form.endereco}
              onChange={(e) => set('endereco', e.target.value)} error={errors.endereco} />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-700">Vagas e Pagamento</h2>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nº de vagas" type="number" min="1" placeholder="10" value={form.vagasTotal}
                onChange={(e) => set('vagasTotal', e.target.value)} error={errors.vagasTotal}
                inputMode="numeric" />
              <Input label="Valor/hora (R$)" type="number" min="0" step="0.01" placeholder="25.00"
                value={form.valorHora} onChange={(e) => set('valorHora', e.target.value)}
                error={errors.valorHora} inputMode="decimal" />
            </div>
          </div>

          <Button type="submit" size="lg" loading={loading}>
            Publicar Evento
          </Button>
        </form>
      </main>
    </div>
  )
}
