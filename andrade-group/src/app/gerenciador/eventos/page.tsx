import { auth }                  from '@/auth'
import { redirect }              from 'next/navigation'
import { getEventosByGerenciador } from '@/lib/google-sheets'
import { rowToEvento }           from '@/app/api/eventos/route'
import { AppShell }              from '@/components/Layout/AppShell'
import { PageHeader }            from '@/components/Layout/PageHeader'
import Link                      from 'next/link'
import { CalendarDays, ChevronRight, PlusCircle, Clock } from 'lucide-react'

const STATUS_STYLE: Record<string, string> = {
  aberto:   'bg-emerald-100 text-emerald-700',
  fechado:  'bg-slate-100 text-slate-500',
  cancelado:'bg-red-100 text-red-600',
}

export default async function MeusEventosPage() {
  const session = await auth()
  if (!session?.managerId) redirect('/gerenciador/login')

  const rows   = await getEventosByGerenciador(session.managerId)
  const eventos = rows.map(rowToEvento).sort((a, b) => b.data.localeCompare(a.data))

  return (
    <AppShell>
      <PageHeader title="Meus Eventos" subtitle="Área administrativa" backHref="/" />

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-3">
        <Link href="/cadastrar-eventos"
          className="flex items-center gap-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 rounded-2xl px-4 py-3.5 text-white shadow-md shadow-amber-200 transition-all group">
          <PlusCircle className="w-5 h-5 shrink-0" />
          <span className="flex-1 font-semibold text-sm">Criar novo evento</span>
          <ChevronRight className="w-4 h-4 text-amber-200 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        {eventos.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Nenhum evento ainda</p>
            <p className="text-xs mt-1">Crie seu primeiro evento acima</p>
          </div>
        ) : (
          <div className="space-y-2">
            {eventos.map(e => {
              const dataFmt = new Intl.DateTimeFormat('pt-BR').format(new Date(e.data + 'T12:00:00'))
              const totalVagas = e.equipes.reduce((s, eq) => s + eq.vagas, 0)
              return (
                <Link key={e.id} href={`/gerenciador/eventos/${e.id}`}
                  className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98] group">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-800 truncate">{e.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {dataFmt}
                      </span>
                      {totalVagas > 0 && (
                        <span className="text-xs text-slate-400">· {totalVagas} vagas</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[e.status] ?? ''}`}>
                      {e.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-400 transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </AppShell>
  )
}
