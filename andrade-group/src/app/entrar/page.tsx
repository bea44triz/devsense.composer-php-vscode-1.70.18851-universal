'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Lock, Mail } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export default function EntrarPage() {
  return <Suspense><Entrar /></Suspense>
}

function Entrar() {
  const router = useRouter()
  const search = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const next = search.get('next')
  // só caminhos internos (evita redirecionamento aberto)
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErr(null)
    if (!isSupabaseConfigured) return setErr('ERP ainda não conectado ao Supabase.')
    setBusy(true)
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) return setErr(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
    router.replace(target)
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900">
      <div className="relative overflow-hidden px-6 pb-10 pt-16 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-amber-500/15 blur-3xl" />
        <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Gestão operacional</p>
        <h1 className="mt-1 text-3xl font-black">Eventos e Pontos Fixos</h1>
        <p className="mt-2 text-sm text-slate-400">Equipes, presença e fechamento em um só lugar.</p>
      </div>
      <form onSubmit={submit} className="flex-1 space-y-4 rounded-t-[2rem] bg-slate-50 px-6 pb-10 pt-8">
        <div className="mx-auto max-w-sm space-y-4">
          <Input label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail className="h-4 w-4" />} />
          <Input label="Senha" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} icon={<Lock className="h-4 w-4" />} />
          {err && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}
          <button type="submit" disabled={busy || !email || !password}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 font-bold text-white shadow-md shadow-amber-200 disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Entrar
          </button>
          <p className="text-center text-xs text-slate-400">O acesso é liberado pelo administrador da sua empresa.</p>
        </div>
      </form>
    </div>
  )
}
