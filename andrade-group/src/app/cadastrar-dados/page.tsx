'use client'
import { useState, useRef } from 'react'
import { AppShell } from '@/components/Layout/AppShell'
import { PageHeader } from '@/components/Layout/PageHeader'
import { Card, CardSection } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { formatCpf, formatPhone } from '@/lib/utils'
import { Upload, CheckCircle2, FileText, X, Copy, User, Phone, Mail, Banknote } from 'lucide-react'

interface FormData {
  nome: string
  cpf: string
  telefone: string
  email: string
  pix: string
  documento: File | null
}
const empty: FormData = { nome: '', cpf: '', telefone: '', email: '', pix: '', documento: null }

export default function CadastrarDadosPage() {
  const [form, setForm]       = useState<FormData>(empty)
  const [errors, setErrors]   = useState<Partial<Record<keyof FormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [newId, setNewId]     = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)
  const fileRef               = useRef<HTMLInputElement>(null)

  const set = (f: keyof FormData, v: string) => {
    setForm(p => ({ ...p, [f]: v }))
    setErrors(p => ({ ...p, [f]: undefined }))
  }

  const validate = () => {
    const e: Partial<Record<keyof FormData, string>> = {}
    if (!form.nome.trim())                             e.nome      = 'Nome obrigatório'
    if (form.cpf.replace(/\D/g, '').length !== 11)    e.cpf       = 'CPF inválido'
    if (form.telefone.replace(/\D/g, '').length < 10) e.telefone  = 'Telefone inválido'
    if (!/\S+@\S+\.\S+/.test(form.email))             e.email     = 'E-mail inválido'
    if (!form.pix.trim())                              e.pix       = 'Chave PIX obrigatória'
    if (!form.documento)                               e.documento = 'Documento obrigatório'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (file && file.size > 10 * 1024 * 1024) {
      setErrors(p => ({ ...p, documento: 'Arquivo muito grande (máx 10 MB)' }))
      return
    }
    setForm(p => ({ ...p, documento: file }))
    setErrors(p => ({ ...p, documento: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('nome', form.nome)
      fd.append('cpf', form.cpf.replace(/\D/g, ''))
      fd.append('telefone', form.telefone.replace(/\D/g, ''))
      fd.append('email', form.email)
      fd.append('pix', form.pix)
      if (form.documento) fd.append('documento', form.documento)
      const res  = await fetch('/api/freelancers', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao cadastrar.')
      setNewId(data.data.id)
      setSucesso(true)
    } catch (err) {
      setErrors({ nome: err instanceof Error ? err.message : 'Erro inesperado.' })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!newId) return
    await navigator.clipboard.writeText(newId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /* ── Sucesso ── */
  if (sucesso && newId) {
    return (
      <AppShell>
        <PageHeader title="Cadastro enviado" backHref="/" />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5 py-10 text-center animate-slide-up">
          <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800">Tudo certo!</h2>
            <p className="text-slate-500 text-sm mt-1">Aguarde a validação do administrador.</p>
          </div>

          <Card className="w-full max-w-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Seu ID de Freelancer</p>
            <p className="font-mono text-sm font-bold text-slate-800 break-all bg-slate-50 rounded-xl px-3 py-2">
              {newId}
            </p>
            <button onClick={handleCopy}
              className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 hover:underline font-semibold mx-auto">
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copiado!' : 'Copiar ID'}
            </button>
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              Use este ID para fazer check-in nos eventos.
            </p>
          </Card>

          <Button variant="outline" className="w-full max-w-sm" onClick={() => { setSucesso(false); setForm(empty) }}>
            Novo cadastro
          </Button>
        </div>
      </AppShell>
    )
  }

  /* ── Formulário ── */
  return (
    <AppShell>
      <PageHeader title="Cadastro de Freelancer" backHref="/" />

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

          <Card>
            <CardSection title="Dados pessoais">
              <Input label="Nome completo" placeholder="João da Silva"
                value={form.nome} onChange={e => set('nome', e.target.value)}
                error={errors.nome} icon={<User className="w-4 h-4" />} />
              <Input label="CPF" placeholder="000.000.000-00"
                value={form.cpf} onChange={e => set('cpf', formatCpf(e.target.value))}
                error={errors.cpf} inputMode="numeric" />
              <Input label="Telefone / WhatsApp" placeholder="(11) 99999-9999"
                value={form.telefone} onChange={e => set('telefone', formatPhone(e.target.value))}
                error={errors.telefone} inputMode="tel" icon={<Phone className="w-4 h-4" />} />
              <Input label="E-mail" type="email" placeholder="joao@email.com"
                value={form.email} onChange={e => set('email', e.target.value)}
                error={errors.email} icon={<Mail className="w-4 h-4" />} />
            </CardSection>
          </Card>

          <Card>
            <CardSection title="Pagamento">
              <Input label="Chave PIX" placeholder="CPF, e-mail, telefone ou chave aleatória"
                value={form.pix} onChange={e => set('pix', e.target.value)}
                error={errors.pix} icon={<Banknote className="w-4 h-4" />} />
            </CardSection>
          </Card>

          <Card>
            <CardSection title="Documento de identidade">
              <p className="text-xs text-slate-400 -mt-2">RG, CNH ou similar (PDF, JPG, PNG — máx 10 MB)</p>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFile} className="hidden" />

              {form.documento ? (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
                  <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-sm text-emerald-800 flex-1 truncate font-medium">{form.documento.name}</span>
                  <button type="button" onClick={() => setForm(p => ({ ...p, documento: null }))}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-2xl p-7 flex flex-col items-center gap-2.5 transition-colors
                    ${errors.documento ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-amber-400 hover:bg-amber-50/50'}`}>
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-600">Toque para enviar</p>
                    <p className="text-xs text-slate-400 mt-0.5">PDF, JPG ou PNG</p>
                  </div>
                </button>
              )}
              {errors.documento && <p className="text-xs text-red-500">⚠ {errors.documento}</p>}
            </CardSection>
          </Card>

          <Button type="submit" size="lg" loading={loading}>
            Enviar Cadastro
          </Button>
        </form>
      </main>
    </AppShell>
  )
}
