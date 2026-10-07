'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, CreditCard, Loader2, Mail, Phone, User, Users, Wallet } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { cn, formatCpf, formatPhone, hasFullName, isValidCelular, isValidCpf, isValidEmail, isValidPixKey, onlyDigits } from '@/lib/utils'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { useLoad } from '@/lib/erp/use-load'
import { brl, PARTICIPANT_LABEL, type ParticipantStatus } from '@/lib/erp/ops'
import { PublicCard, PublicShell } from '@/components/erp/PublicShell'

interface Info {
  team_name: string; event_name: string; event_code: string; company_name: string
  event_date: string; start_time: string | null; end_time: string | null; location: string | null; address: string | null
  rate: number | null; open: boolean; vacancies: number
}
interface Lookup { found: boolean; first_name?: string; phone_hint?: string; email_hint?: string; has_pix?: boolean; participation_status?: ParticipantStatus | null }

const PIX_TIPOS = [
  { value: 'cpf', label: 'CPF', placeholder: '000.000.000-00' },
  { value: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0001-00' },
  { value: 'celular', label: 'Celular', placeholder: '(11) 99999-0000' },
  { value: 'email', label: 'E-mail', placeholder: 'seu@email.com' },
  { value: 'aleatoria', label: 'Aleatória', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
]

export default function InscricaoPage() {
  const { token } = useParams<{ token: string }>()
  const info = useLoad(async () => {
    if (!isSupabaseConfigured) return null
    const { data, error } = await getSupabase().rpc('public_invite_info', { _token: token })
    if (error) throw error
    return data as unknown as Info | null
  }, token)

  if (info.loading) return <PublicShell><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div></PublicShell>
  if (!info.data) return <PublicShell title="Link inválido"><PublicCard><p className="text-center text-sm text-slate-500">Confira o link com o coordenador da equipe.</p></PublicCard></PublicShell>
  return <Inscricao token={token} info={info.data} />
}

function Inscricao({ token, info }: { token: string; info: Info }) {
  const [step, setStep] = useState<'intro' | 'cpf' | 'form' | 'done'>('intro')
  const [cpf, setCpf] = useState('')
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [f, setF] = useState({ full_name: '', phone: '', email: '', pix_type: '', pix_key: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof f | 'cpf', string>>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<{ status: ParticipantStatus; already: boolean } | null>(null)
  const isNew = !lookup?.found
  const pixInfo = PIX_TIPOS.find((p) => p.value === f.pix_type)

  async function checkCpf() {
    setErr(null)
    if (!isValidCpf(cpf)) return setErrors({ cpf: 'CPF inválido. Verifique os 11 dígitos.' })
    setErrors({}); setBusy(true)
    const { data, error } = await getSupabase().rpc('public_invite_lookup', { _token: token, _cpf: onlyDigits(cpf) })
    setBusy(false)
    if (error) return setErr(error.message)
    const l = data as unknown as Lookup
    setLookup(l)
    if (l.participation_status) { setResult({ status: l.participation_status, already: true }); setStep('done'); return }
    setStep('form')
  }

  function validate() {
    const e: typeof errors = {}
    if (isNew && !hasFullName(f.full_name)) e.full_name = 'Informe nome e sobrenome.'
    if ((isNew || f.phone) && !isValidCelular(f.phone)) e.phone = 'Celular com DDD + 9 dígitos.'
    if ((isNew || f.email) && !isValidEmail(f.email)) e.email = 'E-mail inválido.'
    if (isNew && !f.pix_type) e.pix_type = 'Escolha o tipo da chave PIX.'
    if ((isNew || f.pix_key || f.pix_type) && (!f.pix_type || !isValidPixKey(f.pix_key, f.pix_type))) e.pix_key = 'Chave PIX inválida para o tipo escolhido.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setErr(null)
    if (!validate()) return
    setBusy(true)
    const { data, error } = await getSupabase().rpc('public_invite_register', {
      _token: token,
      _data: { cpf: onlyDigits(cpf), full_name: f.full_name.trim(), phone: onlyDigits(f.phone), email: f.email.trim(), pix_type: f.pix_type, pix_key: f.pix_key.trim() },
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setResult(data as unknown as { status: ParticipantStatus; already: boolean })
    setStep('done')
  }

  const setField = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setErrors((x) => ({ ...x, [k]: undefined })) }

  return (
    <PublicShell company={info.company_name} badge={info.team_name} title={info.event_name} date={info.event_date}
      start={info.start_time} end={info.end_time} location={info.location} address={info.address}>
      <div className="grid grid-cols-2 gap-3">
        {info.rate != null && <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"><div className="text-[11px] font-semibold uppercase text-slate-400">Valor</div><div className="text-xl font-black">{brl(info.rate)}</div></div>}
        <div className={cn('rounded-2xl border border-slate-100 bg-white p-3 shadow-sm', info.rate == null && 'col-span-2')}>
          <div className="text-[11px] font-semibold uppercase text-slate-400">Vagas</div>
          <div className="flex items-center gap-1.5 text-xl font-black"><Users className="h-4 w-4 text-amber-500" />{info.vacancies > 0 ? info.vacancies : 'Preenchidas'}</div>
        </div>
      </div>

      <PublicCard>
        {!info.open && step !== 'done' ? (
          <div className="py-4 text-center">
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600">Indisponível</span>
            <p className="mt-3 text-sm text-slate-500">As inscrições para esta equipe estão encerradas.</p>
          </div>
        ) : step === 'intro' ? (
          <>
            {info.vacancies === 0 && <p className="text-center text-sm text-slate-500">As vagas já foram preenchidas, mas você pode entrar na <b>lista de espera</b>.</p>}
            <button onClick={() => setStep('cpf')} className="w-full rounded-2xl bg-amber-500 py-4 text-base font-black tracking-wide text-white shadow-md shadow-amber-200">
              {info.vacancies === 0 ? 'ENTRAR NA LISTA DE ESPERA' : 'QUERO PARTICIPAR'}
            </button>
            <p className="text-center text-xs text-slate-400">A inscrição não garante a vaga: o coordenador confirma sua participação.</p>
          </>
        ) : step === 'cpf' ? (
          <form onSubmit={(e) => { e.preventDefault(); checkCpf() }} className="space-y-4">
            <Input label="Seu CPF" placeholder="000.000.000-00" inputMode="numeric" autoFocus value={formatCpf(cpf)} maxLength={14}
              onChange={(e) => { setCpf(onlyDigits(e.target.value)); setErrors({}) }} error={errors.cpf} icon={<CreditCard className="h-4 w-4" />} />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Continuar</button>
          </form>
        ) : step === 'form' ? (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {lookup?.found ? (
              <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900">
                <b>Encontramos seu cadastro, {lookup.first_name}.</b>
                <div className="mt-1 text-xs">Celular {lookup.phone_hint ?? '—'} · E-mail {lookup.email_hint ?? '—'} · PIX {lookup.has_pix ? 'cadastrado' : 'não cadastrado'}</div>
                <div className="mt-1 text-xs">Preencha abaixo só o que quiser atualizar.</div>
              </div>
            ) : (
              <Input label="Nome completo" placeholder="Nome e sobrenome" value={f.full_name} onChange={(e) => setField('full_name', e.target.value)} error={errors.full_name} icon={<User className="h-4 w-4" />} />
            )}
            <Input label="Celular / WhatsApp" placeholder="(11) 99999-0000" inputMode="tel" maxLength={15} value={formatPhone(f.phone)}
              onChange={(e) => setField('phone', onlyDigits(e.target.value))} error={errors.phone} icon={<Phone className="h-4 w-4" />} />
            <Input label="E-mail" type="email" placeholder="seu@email.com" value={f.email} onChange={(e) => setField('email', e.target.value)} error={errors.email} icon={<Mail className="h-4 w-4" />} />
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Wallet className="h-3.5 w-3.5" />Tipo de chave PIX</p>
              <div className="flex flex-wrap gap-2">
                {PIX_TIPOS.map((p) => (
                  <button key={p.value} type="button" onClick={() => { setF((x) => ({ ...x, pix_type: p.value, pix_key: '' })); setErrors((x) => ({ ...x, pix_type: undefined, pix_key: undefined })) }}
                    className={cn('rounded-xl border px-3 py-1.5 text-xs font-bold', f.pix_type === p.value ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 bg-white text-slate-600')}>{p.label}</button>
                ))}
              </div>
              {errors.pix_type && <p className="text-xs text-red-500">⚠ {errors.pix_type}</p>}
            </div>
            <Input label="Chave PIX" placeholder={pixInfo?.placeholder ?? 'Escolha o tipo acima'} value={f.pix_key} disabled={!f.pix_type}
              onChange={(e) => setField('pix_key', e.target.value)} error={errors.pix_key} />
            {err && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Enviar inscrição</button>
            <p className="text-center text-xs text-slate-400">Ao se inscrever você concorda em compartilhar seus dados com {info.company_name} para fins de contratação e pagamento.</p>
          </form>
        ) : result && (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100"><CheckCircle2 className="h-8 w-8 text-emerald-500" /></div>
            <h2 className="mt-3 text-xl font-black text-slate-800">
              {result.status === 'confirmado' ? 'Participação confirmada' : result.already ? 'Você já está inscrito' : 'Inscrição recebida'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Situação: <b>{PARTICIPANT_LABEL[result.status]}</b></p>
            {(result.status === 'aguardando' || result.status === 'inscrito' || result.status === 'lista_espera') && (
              <p className="mt-2 text-sm text-slate-500">O coordenador vai conferir e confirmar sua participação. Volte a este link para acompanhar.</p>
            )}
          </div>
        )}
      </PublicCard>
    </PublicShell>
  )
}
