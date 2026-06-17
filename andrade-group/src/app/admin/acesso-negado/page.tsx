import Link from 'next/link'
import { ShieldX } from 'lucide-react'

export default function AcessoNegadoPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-5 text-center">
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
        <ShieldX className="w-10 h-10 text-red-400" />
      </div>
      <h1 className="text-2xl font-black text-white mb-2">Acesso negado</h1>
      <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
        Sua conta Google não tem permissão para acessar a área administrativa.
        Entre em contato com o responsável para solicitar acesso.
      </p>
      <Link href="/"
        className="mt-8 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-2xl px-6 py-3 transition-all active:scale-[0.98]">
        Voltar ao início
      </Link>
    </div>
  )
}
