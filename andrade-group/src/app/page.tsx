import Link from 'next/link'
import { AppShell } from '@/components/Layout/AppShell'
import { auth } from '@/auth'
import { ScanLine, CalendarDays, UserPlus, ChevronRight, Sparkles, LogIn, PlusCircle } from 'lucide-react'

const quickActions = [
  {
    href: '/checkinout',
    label: 'Check-in / Check-out',
    desc: 'Registre sua presença no evento',
    Icon: ScanLine,
    iconBg: 'bg-amber-500',
    featured: true,
  },
  {
    href: '/eventos',
    label: 'Ver Eventos',
    desc: 'Confira os eventos disponíveis',
    Icon: CalendarDays,
    iconBg: 'bg-slate-700',
    featured: false,
  },
  {
    href: '/cadastrar-dados',
    label: 'Cadastro de Freelancer',
    desc: 'Crie seu perfil para trabalhar',
    Icon: UserPlus,
    iconBg: 'bg-slate-700',
    featured: false,
  },
]

export default async function Home() {
  const session = await auth()
  const isManager = !!session?.managerId

  return (
    <AppShell>
      {/* ── Hero ── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-5 pt-14 pb-8">
        <div className="pointer-events-none absolute -top-16 -right-12 w-56 h-56 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-4 w-40 h-40 rounded-full bg-amber-400/10 blur-2xl" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
              <Sparkles className="w-3 h-3" /> Plataforma de Freelancers
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-tight">
              Andrade<br />
              <span className="text-amber-400">Group</span>
            </h1>
            <p className="text-slate-400 text-sm mt-2">Gestão de eventos e equipes</p>
          </div>
          <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-900/30">
            <span className="text-white font-black text-xl">AG</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Acesso rápido</p>

        <div className="stagger space-y-3">
          {quickActions.map(({ href, label, desc, Icon, iconBg, featured }) => (
            <Link key={href} href={href}
              className={`animate-slide-up flex items-center gap-4 rounded-2xl p-4 transition-all active:scale-[0.98] group
                ${featured
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 shadow-lg shadow-amber-200'
                  : 'bg-white border border-slate-100 shadow-sm hover:shadow-md'
                }`}>
              <div className={`w-12 h-12 rounded-xl ${featured ? 'bg-white/20' : iconBg} flex items-center justify-center shrink-0`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${featured ? 'text-white' : 'text-slate-800'}`}>{label}</p>
                <p className={`text-xs mt-0.5 ${featured ? 'text-amber-100' : 'text-slate-400'}`}>{desc}</p>
              </div>
              <ChevronRight className={`w-5 h-5 shrink-0 group-hover:translate-x-0.5 transition-transform ${featured ? 'text-white/70' : 'text-slate-300'}`} />
            </Link>
          ))}
        </div>

        {/* ── Área do gerenciador ── */}
        <div className="pt-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 mb-3">
            Área do Gerenciador
          </p>

          {isManager ? (
            <div className="animate-slide-up space-y-2">
              {/* Badge do gerenciador logado */}
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

              <Link href="/cadastrar-eventos"
                className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 rounded-2xl px-4 py-3.5 transition-all active:scale-[0.98] group">
                <PlusCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="flex-1 text-sm font-semibold text-white">Criar novo evento</span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
              </Link>
            </div>
          ) : (
            /* Não logado — convite para entrar */
            <Link href="/gerenciador/login"
              className="animate-slide-up flex items-center gap-4 bg-slate-800/70 border border-dashed border-slate-600 rounded-2xl p-4 transition-all active:scale-[0.98] hover:border-amber-500/50 hover:bg-slate-800 group">
              <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
                <LogIn className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-200">Sou gerenciador</p>
                <p className="text-xs mt-0.5 text-slate-500">Entre com seu Gmail para criar eventos</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-amber-400 transition-colors shrink-0" />
            </Link>
          )}
        </div>
      </main>
    </AppShell>
  )
}
