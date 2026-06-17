'use client'
import { useState, useRef } from 'react'
import { PageHeader } from '@/components/Layout/PageHeader'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { formatCpf, formatPhone } from '@/lib/utils'
import { Upload, CheckCircle2, FileText, X } from 'lucide-react'

interface FormData {
  nome: string
  cpf: string
  telefone: string
  email: string
  pix: string
  documento: File | null
}

const emptyForm: FormData = {
  nome: '',
  cpf: '',
  telefone: '',
  email: '',
  pix: '',
  documento: null,
}

export default function CadastrarDadosPage() {
  const [form, setForm] = useState<FormData>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [freelancerId, setFreelancerId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const set = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.nome.trim()) errs.nome = 'Nome obrigatório'
    if (form.cpf.replace(/\D/g, '').length !== 11) errs.cpf = 'CPF inválido'
    if (form.telefone.replace(/\D/g, '').length < 10) errs.telefone = 'Telefone inválido'
    if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'E-mail inválido'
    if (!form.pix.trim()) errs.pix = 'Chave PIX obrigatória'
    if (!form.documento) errs.documento = 'Documento obrigatório'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (file && file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, documento: 'Arquivo muito grande (máx 10 MB)' }))
      return
    }
    setForm((prev) => ({ ...prev, documento: file }))
    setErrors((prev) => ({ ...prev, documento: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    try {
      const payload = new FormData()
      payload.append('nome', form.nome)
      payload.append('cpf', form.cpf.replace(/\D/g, ''))
      payload.append('telefone', form.telefone.replace(/\D/g, ''))
      payload.append('email', form.email)
      payload.append('pix', form.pix)
      if (form.documento) payload.append('documento', form.documento)

      const res = await fetch('/api/freelancers', { method: 'POST', body: payload })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao cadastrar.')

      setFreelancerId(data.data.id)
      setSucesso(true)
    } catch (err) {
      setErrors({ nome: err instanceof Error ? err.message : 'Erro inesperado.' })
    } finally {
      setLoading(false)
    }
  }

  if (sucesso && freelancerId) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <PageHeader title="Cadastro Realizado" backHref="/" />
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Cadastro enviado!</h2>
            <p className="text-slate-500 text-sm mt-1">Aguarde a validação do administrador.</p>
          </div>
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm shadow-sm">
            <p className="text-xs text-slate-400 mb-1">Seu ID de Freelancer</p>
            <p className="font-mono text-sm font-bold text-slate-800 break-all">{freelancerId}</p>
            <p className="text-xs text-slate-400 mt-2">Guarde esse ID para usar no check-in.</p>
          </div>
          <Button variant="outline" onClick={() => { setSucesso(false); setForm(emptyForm) }}>
            Novo cadastro
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <PageHeader title="Cadastro de Freelancer" subtitle="Andrade Group" backHref="/" />

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-700">Dados Pessoais</h2>
            <Input label="Nome completo" placeholder="João da Silva" value={form.nome}
              onChange={(e) => set('nome', e.target.value)} error={errors.nome} />
            <Input label="CPF" placeholder="000.000.000-00" value={form.cpf}
              onChange={(e) => set('cpf', formatCpf(e.target.value))} error={errors.cpf}
              inputMode="numeric" />
            <Input label="Telefone / WhatsApp" placeholder="(11) 99999-9999" value={form.telefone}
              onChange={(e) => set('telefone', formatPhone(e.target.value))} error={errors.telefone}
              inputMode="tel" />
            <Input label="E-mail" type="email" placeholder="joao@email.com" value={form.email}
              onChange={(e) => set('email', e.target.value)} error={errors.email} />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-700">Pagamento</h2>
            <Input label="Chave PIX" placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={form.pix} onChange={(e) => set('pix', e.target.value)} error={errors.pix} />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="font-semibold text-slate-700">Documento de Identidade</h2>
            <p className="text-xs text-slate-500">RG, CNH ou outro documento com foto (PDF, JPG, PNG — máx 10 MB)</p>

            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange} className="hidden" />

            {form.documento ? (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-sm text-emerald-800 flex-1 truncate">{form.documento.name}</span>
                <button type="button" onClick={() => setForm((p) => ({ ...p, documento: null }))}
                  className="text-emerald-600 hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 transition-colors
                  ${errors.documento ? 'border-red-300 bg-red-50' : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50'}`}>
                <Upload className="w-8 h-8 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">Toque para enviar documento</span>
              </button>
            )}
            {errors.documento && <p className="text-xs text-red-600">{errors.documento}</p>}
          </div>

          <Button type="submit" size="lg" loading={loading}>
            Enviar Cadastro
          </Button>
        </form>
      </main>
    </div>
  )
}
