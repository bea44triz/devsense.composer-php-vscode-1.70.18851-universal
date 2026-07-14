'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Input }  from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CheckCircle2, User, Phone, Mail, CreditCard, Wallet } from 'lucide-react'
import { Evento } from '@/types'
import {
  isValidCpf, isValidEmail, isValidPhone, isValidPixKey,
  hasFullName, onlyDigits, formatCpf, formatPhone,
} from '@/lib/utils'

const PIX_TIPOS = [
  { value: 'cpf',       label: 'CPF'      },
  { value: 'telefone',  label: 'Telefone' },
  { value: 'email',     label: 'E-mail'   },
  { value: 'aleatoria', label: 'Aleatória'},
]

// Fallback labels for the three original teams (for backwards-compatible events
// stored before the label field was added)
const KNOWN_LABELS: Record<string, string> = {
  brigadistas: 'Brigadistas',
  segurancas:  'Seguranças',
  limpeza:     'Limpeza',
}
const TIPO_LABELS: Record<string, string> = {
  coordenador: 'Coordenador',
  freelancer:  'Freelancer',
}

function getEquipeLabel(equipe: string, evento: Evento | null): string {
  const fromEvento = evento?.equipes.find(e => e.equipe === equipe)?.label
  return fromEvento ?? KNOWN_LABELS[equipe] ?? equipe
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

  // Clear pixChave whenever the type changes
  const setPixTipo = (v: string) => {
    setForm(p => ({ ...p, pixTipo: v, pixChave: '' }))
    setErrors(p => ({ ...p, pixTipo: undefined, pixChave: undefined }))
  }

  // ── Validation ────────────────────────────────────────────────────────────────

  const validate = () => {
    const e: Partial<typeof form> = {}

    if (!hasFullName(form.nome))
      e.nome = 'Informe nome e sobrenome.'

    if (!isValidCpf(form.cpf))
      e.cpf = 'CPF inválido. Verifique os 11 dígitos.'

    if (!isValidPhone(form.telefone))
      e.telefone = 'Informe DDD + número (10 ou 11 dígitos).'

    if (!isValidEmail(form.email))
      e.email = 'E-mail inválido.'

    if (!isValidPixKey(form.pixChave, form.pixTipo))
      e.pixChave = pixKeyErrorMsg(form.pixTipo)

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function pixKeyErrorMsg(tipo: string): string {
    switch (tipo) {
      case 'cpf':       return 'Informe um CPF válido como chave PIX.'
      case 'telefone':  return 'Informe um telefone válido como chave PIX.'
      case 'email':     return 'Informe um e-mail válido como chave PIX.'
      case 'aleatoria': return 'Chave aleatória deve ter formato UUID (36 caracteres).'
      default:          return 'Chave PIX inválida.'
    }
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true); setErro(null)
    try {
      const res = await fetch('/api/inscricoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventoId, equipe, tipo,
          nome:     form.nome.trim(),
          cpf:      onlyDigits(form.cpf),
          telefone: onlyDigits(form.telefone),
          email:    form.email.trim(),
          pixTipo:  form.pixTipo,
          pixChave: form.pixChave.trim(),
        }),
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
          Você está inscrito como <strong>{TIPO_LABELS[tipo] ?? tipo}</strong> na equipe de{' '}
          <strong>{getEquipeLabel(equipe, evento)}</strong>.
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
      <header className="bg-slate-900 text-white px-5 pt-12 pb-6">
        <div className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
          {getEquipeLabel(equipe, evento)} · {TIPO_LABELS[tipo] ?? tipo}
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
            <Input label="Nome completo" placeholder="Nome e Sobrenome" value={form.nome}
              onChange={e => set('nome', e.target.value)} error={errors.nome}
              icon={<User className="w-4 h-4" />} />

            <Input label="CPF" placeholder="000.000.000-00"
              value={formatCpf(form.cpf)}
              onChange={e => set('cpf', onlyDigits(e.target.value))}
              error={errors.cpf}
              icon={<CreditCard className="w-4 h-4" />}
              inputMode="numeric"
              maxLength={14} />

            <Input label="Telefone / WhatsApp" placeholder="(11) 99999-0000"
              value={formatPhone(form.telefone)}
              onChange={e => set('telefone', onlyDigits(e.target.value))}
              error={errors.telefone}
              icon={<Phone className="w-4 h-4" />}
              inputMode="tel"
              maxLength={15} />

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
                  onClick={() => setPixTipo(p.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border
                    ${form.pixTipo === p.value
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-slate-600 border-slate-200'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <Input label="Chave PIX" placeholder={pixPlaceholder(form.pixTipo)}
              value={form.pixChave}
              onChange={e => set('pixChave', e.target.value)}
              error={errors.pixChave} />
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

function pixPlaceholder(tipo: string): string {
  switch (tipo) {
    case 'cpf':       return '000.000.000-00'
    case 'telefone':  return '(11) 99999-0000'
    case 'email':     return 'seu@email.com'
    case 'aleatoria': return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
    default:          return 'Sua chave PIX'
  }
}
