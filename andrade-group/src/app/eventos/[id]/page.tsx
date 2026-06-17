'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/Layout/AppShell'
import { PageHeader } from '@/components/Layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { EventCardSkeleton } from '@/components/ui/Skeleton'
import { formatCurrency, formatDate, vagasDisponiveis } from '@/lib/utils'
import { Evento, Inscricao } from '@/types'
import {
  Calendar, Clock, MapPin, Users, DollarSign,
  UserPlus, AlertCircle, CheckCircle2, Hash,
  ExternalLink,
} from 'lucide-react'

export default function EventoDetalhesPage() {
  const { id } = useParams<{ id: string }>()

  const [evento, setEvento]             = useState<Evento | null>(null)
  const [loadingEvento, setLoading]     = useState(true)
  const [freelancerId, setFId]          = useState('')
  const [inscLoading, setInscLoading]   = useState(false)
  const [inscSucesso, setInscSucesso]   = useState<Inscricao | null>(null)
  const [inscError, setInscError]       = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/eventos/${id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setEvento(d.data) })
      .finally(() => setLoading(false))
  }, [id])

  const vagas = evento ? vagasDisponiveis(evento.vagasTotal, evento.vagasOcupadas) : 0
  const listaEspera = vagas === 0
  const pct = evento ? Math.min((evento.vagasOcupadas / evento.vagasTotal) * 100, 100) : 0

  const statusVariant: Record<string, 'success' | 'danger' | 'neutral'> = {
    aberto: 'success', fechado: 'danger', cancelado: 'neutral',
  }

  const handleInscrever = async () => {
    if (!freelancerId.trim()) { setInscError('Informe seu ID de freelancer.'); return }
    setInscLoading(true)
    setInscError(null)
    try {
      const res  = await fetch('/api/vagas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventoId: id, freelancerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao inscrever.')
      setInscSucesso(data.data)
      setEvento(prev => prev
        ? { ...prev, vagasOcupadas: data.data.status === 'confirmado' ? prev.vagasOcupadas + 1 : prev.vagasOcupadas }
        : prev)
    } catch (err) {
      setInscError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setInscLoading(false)
    }
  }

  /* ── Loading ── */
  if (loadingEvento) {
    return (
      <AppShell>
        <PageHeader title="Carregando…" backHref="/eventos" />
        <div className="px-4 py-5 space-y-3">
          <EventCardSkeleton />
          <EventCardSkeleton />
        </div>
      </AppShell>
    )
  }

  /* ── Not found ── */
  if (!evento) {
    return (
      <AppShell>
        <PageHeader title="Evento não encontrado" backHref="/eventos" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-slate-600 font-medium">Este evento não existe ou foi removido.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader title={evento.titulo} backHref="/eventos" />

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-4">

        {/* Status badges */}
        <div className="flex gap-2 flex-wrap animate-slide-up">
          <Badge variant={statusVariant[evento.status] ?? 'neutral'} dot>
            {evento.status.charAt(0).toUpperCase() + evento.status.slice(1)}
          </Badge>
          {listaEspera && <Badge variant="warning" dot>Lista de espera</Badge>}
        </div>

        {/* Detalhes */}
        <Card className="animate-slide-up">
          <div className="space-y-3">
            {[
              { Icon: Calendar,   label: 'Data',     value: formatDate(evento.data) },
              { Icon: Clock,      label: 'Horário',  value: `${evento.horaInicio} – ${evento.horaFim}` },
              { Icon: DollarSign, label: 'Valor/h',  value: formatCurrency(evento.valorHora) },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">{label}</p>
                  <p className="text-sm font-bold text-slate-800">{value}</p>
                </div>
              </div>
            ))}

            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-slate-400 font-medium">Local</p>
                <p className="text-sm font-bold text-slate-800">{evento.local}</p>
                <p className="text-xs text-slate-500">{evento.endereco}</p>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(evento.endereco)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-amber-600 font-semibold mt-1 hover:underline"
                >
                  Ver no mapa <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </Card>

        {/* Vagas */}
        <Card className="animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-bold text-slate-800">Vagas</span>
            </div>
            <span className={`text-sm font-black ${vagas === 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {vagas === 0 ? 'Esgotadas' : `${vagas} disponíveis`}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-700 ${vagas === 0 ? 'bg-red-400' : 'bg-emerald-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1.5">
            <span>{evento.vagasOcupadas} confirmados</span>
            <span>{evento.vagasTotal} total</span>
          </div>
        </Card>

        {/* Descrição */}
        {evento.descricao && (
          <Card className="animate-slide-up">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Sobre o evento</p>
            <p className="text-sm text-slate-600 leading-relaxed">{evento.descricao}</p>
          </Card>
        )}

        {/* Inscrição */}
        {evento.status === 'aberto' && !inscSucesso && (
          <Card className="animate-slide-up space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-800">
                {listaEspera ? 'Entrar na Lista de Espera' : 'Confirmar Participação'}
              </h3>
            </div>

            {listaEspera && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-sm text-amber-800 leading-relaxed">
                Vagas esgotadas. Ao se inscrever, você entra na lista de espera e será avisado se uma vaga se abrir.
              </div>
            )}

            <Input label="Seu ID de Freelancer" placeholder="ID recebido no cadastro"
              value={freelancerId} onChange={e => setFId(e.target.value)}
              icon={<Hash className="w-4 h-4" />} />

            {inscError && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-2xl p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {inscError}
              </div>
            )}

            <Button size="lg" loading={inscLoading} onClick={handleInscrever}
              variant={listaEspera ? 'outline' : 'primary'}>
              <UserPlus className="w-5 h-5" />
              {listaEspera ? 'Entrar na lista de espera' : 'Confirmar presença'}
            </Button>
          </Card>
        )}

        {/* Sucesso inscrição */}
        {inscSucesso && (
          <Card className="animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">
                  {inscSucesso.status === 'confirmado' ? 'Presença confirmada!' : 'Na lista de espera!'}
                </p>
                {inscSucesso.posicaoListaEspera && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Posição <strong>{inscSucesso.posicaoListaEspera}ª</strong> na lista
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Faça o check-in no dia via{' '}
              <a href="/checkinout" className="text-amber-600 font-semibold hover:underline">Check-in/Check-out</a>.
            </p>
          </Card>
        )}
      </main>
    </AppShell>
  )
}
