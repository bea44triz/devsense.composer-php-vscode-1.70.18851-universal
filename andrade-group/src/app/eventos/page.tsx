'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/Layout/AppShell'
import { PageHeader } from '@/components/Layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EventCardSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency, formatDate, vagasDisponiveis } from '@/lib/utils'
import { Evento } from '@/types'
import { Calendar, Clock, MapPin, Users, ChevronRight, SearchX } from 'lucide-react'

const statusVariant: Record<string, 'success' | 'danger' | 'neutral'> = {
  aberto: 'success', fechado: 'danger', cancelado: 'neutral',
}

export default function EventosPage() {
  const [eventos, setEventos]   = useState<Evento[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'todos' | 'aberto' | 'fechado'>('todos')

  useEffect(() => {
    fetch('/api/eventos')
      .then(r => r.json())
      .then(d => { if (d.success) setEventos(d.data) })
      .finally(() => setLoading(false))
  }, [])

  const list = filter === 'todos' ? eventos : eventos.filter(e => e.status === filter)

  return (
    <AppShell>
      <PageHeader title="Eventos" subtitle="Andrade Group" />

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-4">

        {/* Filtros */}
        <div className="flex gap-2">
          {(['todos', 'aberto', 'fechado'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all
                ${filter === f ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <EventCardSkeleton key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && list.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <SearchX className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Nenhum evento encontrado</p>
          </div>
        )}

        {/* Lista */}
        <div className="stagger space-y-3">
          {list.map(evento => {
            const vagas = vagasDisponiveis(evento.vagasTotal, evento.vagasOcupadas)
            const pct   = Math.min((evento.vagasOcupadas / evento.vagasTotal) * 100, 100)

            return (
              <Link key={evento.id} href={`/eventos/${evento.id}`}
                className="animate-slide-up block bg-white rounded-2xl shadow-sm border border-slate-100 p-4 transition-all active:scale-[0.98] hover:shadow-md group">

                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm leading-tight truncate">{evento.titulo}</p>
                    <p className="text-xs text-amber-600 font-semibold mt-0.5">{formatCurrency(evento.valorHora)}/h</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={statusVariant[evento.status] ?? 'neutral'} dot>
                      {evento.status}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 mb-3">
                  {[
                    { Icon: Calendar, text: formatDate(evento.data) },
                    { Icon: Clock,    text: `${evento.horaInicio} – ${evento.horaFim}` },
                    { Icon: MapPin,   text: evento.local },
                    { Icon: Users,    text: vagas > 0 ? `${vagas} vagas livres` : 'Lista de espera' },
                  ].map(({ Icon, text }) => (
                    <div key={text} className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                      <Icon className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{text}</span>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${vagas === 0 ? 'bg-red-400' : 'bg-emerald-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      </main>
    </AppShell>
  )
}
