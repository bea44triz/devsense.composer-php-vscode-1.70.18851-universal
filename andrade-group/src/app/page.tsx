import Link from 'next/link'
import { UserPlus, CalendarPlus, QrCode, Calendar } from 'lucide-react'

const links = [
  {
    href: '/checkinout',
    icon: QrCode,
    label: 'Check-in / Check-out',
    desc: 'Registre sua entrada e saída no evento',
    color: 'bg-amber-500',
  },
  {
    href: '/cadastrar-dados',
    icon: UserPlus,
    label: 'Cadastro de Freelancer',
    desc: 'Crie seu perfil para trabalhar nos eventos',
    color: 'bg-slate-700',
  },
  {
    href: '/cadastrar-eventos',
    icon: CalendarPlus,
    label: 'Cadastrar Evento',
    desc: 'Área administrativa — crie novos eventos',
    color: 'bg-slate-700',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Hero */}
      <header className="px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500 mb-4 shadow-lg">
          <Calendar className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white">Andrade Group</h1>
        <p className="text-slate-400 mt-2 text-sm">Gestão de freelancers e eventos</p>
      </header>

      {/* Menu */}
      <main className="flex-1 px-4 max-w-lg mx-auto w-full space-y-3 pb-10">
        {links.map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href}
            className="flex items-center gap-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-2xl p-4 transition-all active:scale-95 group">
            <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shrink-0 shadow`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm">{label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
            </div>
            <svg className="w-5 h-5 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0"
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </main>

      <footer className="text-center pb-6 text-xs text-slate-600">
        Andrade Group © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
