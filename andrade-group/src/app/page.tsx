import Link from 'next/link'
import { AppShell } from '@/components/Layout/AppShell'
import { auth } from '@/auth'
import { CalendarDays, PlusCircle, ChevronRight, Sparkles, LogIn, Users } from 'lucide-react'

export default async function Home() {
  const session   = await auth()
  const isManager = !!session?.managerId

  return (
    <AppShell>
      <header className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-5 pt-14 pb-8">
        <div className="pointer-events-none absolute -top-16 -right-12 w-56 h-56 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-4 w-40 h-40 rounded-full bg-amber-400/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
              <Sparkles className="w-3 h-3" /> Gestão de Eventos
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-tight">
              Andrade<br />
              <span className="text-amber-400">Group</span>
            </h1>
            <p className="text-slate-400 text-sm mt-2">Plataforma administrativa de eventos</p>
          </div>
          <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-900/30">
            <span className="text-white font-black text-xl">AG</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-3">
        {isManager ? (
          <>
            <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2.5">
              {session.user?.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="w-6 h-6 rounded-full ring-1 ring-emerald-300 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-800 truncate">{session.user?.name}</p>
                <p className="text-[10px] text-emerald-600 truncate">{session.user?.email}</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                Gerenciador
              </span>
            </div>

            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 pt-1">Ações rápidas</p>

            <Link href="/cadastrar-eventos"
              className="flex items-center gap-4 rounded-2xl p-4 bg-gradient-to-r from-amber-500 to-amber-400 shadow-lg shadow-amber-200 transition-all active:scale-[0.98] group">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <PlusCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-white">Criar novo evento</p>
                <p className="text-xs mt-0.5 text-amber-100">Gere links de equipe e presença</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/70 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>

            <Link href="/gerenciador/eventos"
              className="flex items-center gap-4 rounded-2xl p-4 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98] group">
              <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
                <CalendarDays className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800">Meus eventos</p>
                <p className="text-xs mt-0.5 text-slate-400">Gerencie eventos e inscrições</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-400 transition-colors shrink-0" />
            </Link>

            <Link href="/perfil"
              className="flex items-center gap-4 rounded-2xl p-4 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98] group">
              <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800">Meu perfil</p>
                <p className="text-xs mt-0.5 text-slate-400">Configurações da conta</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-400 transition-colors shrink-0" />
            </Link>
          </>
        ) : (
          <>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Acesso</p>
            <Link href="/gerenciador/login"
              className="flex items-center gap-4 bg-slate-800/70 border border-dashed border-slate-600 rounded-2xl p-4 transition-all active:scale-[0.98] hover:border-amber-500/50 hover:bg-slate-800 group">
              <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
                <LogIn className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-200">Entrar como gerenciador</p>
                <p className="text-xs mt-0.5 text-slate-500">Use seu Gmail para criar e gerenciar eventos</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-amber-400 transition-colors shrink-0" />
            </Link>
          </>
        )}
      </main>
    </AppShell>
  )
}
