'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Input }  from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CheckCircle2, User, Phone, Mail, CreditCard, Wallet } from 'lucide-react'
import { Evento } from '@/types'

const PIX_TIPOS = [
  { value: 'cpf',       label: 'CPF'      },
  { value: 'telefone',  label: 'Telefone' },
  { value: 'email',     label: 'E-mail'   },
  { value: 'aleatoria', label: 'Aleatória'},
]

const EQUIPE_LABELS: Record<string, string> = {
  brigadistas: 'Brigadistas',
  segurancas:  'Seguranças',
  limpeza:     'Limpeza',
}
const TIPO_LABELS: Record<string, string> = {
  coordenador: 'Coordenador',
  freelancer:  'Freelancer',
}

export default function CadastroPage() {
  const params       = useParams()
  const search       = useSearchParams()
  const eventoId     = params.eventoId as string
  const equipe       = search.get('equipe') ?? ''
  const tipo         = search.get('tipo') ?? ''

  const [evento, setEvento] = useState<Evento | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    nome: '', cpf: '', telefone: '', email: '', pixTipo: 'cpf', pixChave: '',
  })
  const [errors, setErrors] = useState<Partial<typeof form>>({})
  const [submitting, setSubmitting] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/eventos/${eventoId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setEvento(d.data) })
      .finally(() => setLoading(false))
  }, [eventoId])

  const set = (f: keyof typeof form, v: string) => {
    setForm(p => ({ ...p, [f]: v }))
    setErrors(p => ({ ...p, [f]: undefined }))
  }

  const validate = () => {
    const e: Partial<typeof form> = {}
    if (!form.nome.trim())      e.nome      = 'Obrigatório'
    if (!form.cpf.trim())       e.cpf       = 'Obrigatório'
    if (!form.telefone.trim())  e.telefone  = 'Obrigatório'
    if (!form.email.trim())     e.email     = 'Obrigatório'
    if (!form.pixChave.trim())  e.pixChave  = 'Obrigatório'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true); setErro(null)
    try {
      const res = await fetch('/api/inscricoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, eventoId, equipe, tipo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao cadastrar.')
      setSucesso(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (!evento) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-5 text-center">
        <p className="text-slate-500 font-medium">Evento não encontrado.</p>
      </div>
    )
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-5 text-center gap-4">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-800">Cadastro realizado!</h2>
        <p className="text-slate-500 text-sm max-w-xs">
          Você está inscrito como <strong>{TIPO_LABELS[tipo]}</strong> na equipe de{' '}
          <strong>{EQUIPE_LABELS[equipe]}</strong>.
        </p>
        <p className="text-xs text-slate-400">
          O coordenador enviará o link de check-in no dia do evento.
        </p>
      </div>
    )
  }

  const dataEvento = new Intl.DateTimeFormat('pt-BR').format(new Date(evento.data + 'T12:00:00'))

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white px-5 pt-12 pb-6">
        <div className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
          {EQUIPE_LABELS[equipe]} · {TIPO_LABELS[tipo]}
        </div>
        <h1 className="text-xl font-black">{evento.titulo}</h1>
        <p className="text-slate-400 text-sm mt-1">
          {dataEvento} · {evento.horaInicio}–{evento.horaFim} · {evento.local}
        </p>
      </header>

      <main className="px-4 py-5 max-w-lg mx-auto space-y-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Seus dados</p>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
            <Input label="Nome completo" placeholder="Seu nome" value={form.nome}
              onChange={e => set('nome', e.target.value)} error={errors.nome}
              icon={<User className="w-4 h-4" />} />
            <Input label="CPF" placeholder="000.000.000-00" value={form.cpf}
              onChange={e => set('cpf', e.target.value)} error={errors.cpf}
              icon={<CreditCard className="w-4 h-4" />} inputMode="numeric" />
            <Input label="Telefone / WhatsApp" placeholder="(11) 99999-0000" value={form.telefone}
              onChange={e => set('telefone', e.target.value)} error={errors.telefone}
              icon={<Phone className="w-4 h-4" />} inputMode="tel" />
            <Input label="E-mail" type="email" placeholder="seu@email.com" value={form.email}
              onChange={e => set('email', e.target.value)} error={errors.email}
              icon={<Mail className="w-4 h-4" />} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Dados PIX
            </p>
            <div className="flex gap-2 flex-wrap">
              {PIX_TIPOS.map(p => (
                <button key={p.value} type="button"
                  onClick={() => set('pixTipo', p.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border
                    ${form.pixTipo === p.value
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-slate-600 border-slate-200'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <Input label="Chave PIX" placeholder="Digite sua chave" value={form.pixChave}
              onChange={e => set('pixChave', e.target.value)} error={errors.pixChave} />
          </div>

          {erro && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{erro}</p>
          )}

          <Button type="submit" size="lg" loading={submitting}>
            Confirmar cadastro
          </Button>

          <p className="text-xs text-slate-400 text-center pb-4">
            Ao se cadastrar você concorda em compartilhar seus dados com a Andrade Group.
          </p>
        </form>
      </main>
    </div>
  )
}
