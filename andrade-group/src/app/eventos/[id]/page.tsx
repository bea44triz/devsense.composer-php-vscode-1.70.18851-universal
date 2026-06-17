'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { PageHeader } from '@/components/Layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatDate, vagasDisponiveis } from '@/lib/utils'
import { Evento, Inscricao } from '@/types'
import {
  Calendar, Clock, MapPin, Users, DollarSign,
  UserPlus, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react'

export default function EventoDetalhesPage() {
  const { id } = useParams<{ id: string }>()

  const [evento, setEvento] = useState<Evento | null>(null)
  const [loadingEvento, setLoadingEvento] = useState(true)
  const [freelancerId, setFreelancerId] = useState('')
  const [inscricaoLoading, setInscricaoLoading] = useState(false)
  const [inscricaoSucesso, setInscricaoSucesso] = useState<Inscricao | null>(null)
  const [inscricaoError, setInscricaoError] = useState<string | null>(null)

  useEffect(() => {
    async function loadEvento() {
      try {
        const res = await fetch(`/api/eventos/${id}`)
        const data = await res.json()
        if (res.ok) setEvento(data.data)
      } finally {
        setLoadingEvento(false)
      }
    }
    loadEvento()
  }, [id])

  const vagas = evento ? vagasDisponiveis(evento.vagasTotal, evento.vagasOcupadas) : 0
  const listaEspera = vagas === 0

  const handleInscrever = async () => {
    if (!freelancerId.trim()) {
      setInscricaoError('Informe seu ID de freelancer.')
      return
    }
    setInscricaoLoading(true)
    setInscricaoError(null)

    try {
      const res = await fetch('/api/vagas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventoId: id, freelancerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao inscrever.')
      setInscricaoSucesso(data.data)
      setEvento((prev) => prev
        ? { ...prev, vagasOcupadas: data.data.status === 'confirmado' ? prev.vagasOcupadas + 1 : prev.vagasOcupadas }
        : prev
      )
    } catch (err) {
      setInscricaoError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setInscricaoLoading(false)
    }
  }

  if (loadingEvento) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <PageHeader title="Carregando…" backHref="/" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      </div>
    )
  }

  if (!evento) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <PageHeader title="Evento não encontrado" backHref="/" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-slate-600">Este evento não existe ou foi removido.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <PageHeader title={evento.titulo} subtitle={`${formatDate(evento.data)} • ${evento.local}`} backHref="/" />

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-5">

        {/* Badge de status */}
        <div className="flex gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            evento.status === 'aberto' ? 'bg-emerald-100 text-emerald-700' :
            evento.status === 'fechado' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {evento.status.charAt(0).toUpperCase() + evento.status.slice(1)}
          </span>
          {listaEspera && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
              Lista de espera
            </span>
          )}
        </div>

        {/* Card de detalhes */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400">Data</p>
                <p className="text-sm font-semibold text-slate-800">{formatDate(evento.data)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400">Horário</p>
                <p className="text-sm font-semibold text-slate-800">{evento.horaInicio} – {evento.horaFim}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 col-span-2">
              <MapPin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400">Local</p>
                <p className="text-sm font-semibold text-slate-800">{evento.local}</p>
                <p className="text-xs text-slate-500">{evento.endereco}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <DollarSign className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400">Valor/hora</p>
                <p className="text-sm font-semibold text-slate-800">{formatCurrency(evento.valorHora)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400">Vagas</p>
                <p className="text-sm font-semibold text-slate-800">
                  {vagas > 0 ? `${vagas} disponíveis` : 'Esgotadas'}
                </p>
              </div>
            </div>
          </div>

          {/* Barra de progresso de vagas */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>{evento.vagasOcupadas} confirmados</span>
              <span>{evento.vagasTotal} vagas total</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${vagas === 0 ? 'bg-red-400' : 'bg-emerald-400'}`}
                style={{ width: `${Math.min((evento.vagasOcupadas / evento.vagasTotal) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Descrição */}
        {evento.descricao && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-700 mb-2">Sobre o evento</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{evento.descricao}</p>
          </div>
        )}

        {/* Área de inscrição */}
        {evento.status === 'aberto' && !inscricaoSucesso && (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-slate-700">
                {listaEspera ? 'Entrar na Lista de Espera' : 'Confirmar Participação'}
              </h3>
            </div>

            {listaEspera && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                As vagas estão esgotadas. Ao se inscrever, você entrará na lista de espera e será notificado caso uma vaga se abra.
              </div>
            )}

            <Input
              label="Seu ID de Freelancer"
              placeholder="ID recebido no cadastro"
              value={freelancerId}
              onChange={(e) => setFreelancerId(e.target.value)}
            />

            {inscricaoError && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {inscricaoError}
              </div>
            )}

            <Button size="lg" loading={inscricaoLoading} onClick={handleInscrever}
              variant={listaEspera ? 'outline' : 'primary'}>
              <UserPlus className="w-5 h-5" />
              {listaEspera ? 'Entrar na Lista de Espera' : 'Confirmar Presença'}
            </Button>
          </div>
        )}

        {/* Sucesso na inscrição */}
        {inscricaoSucesso && (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <h3 className="font-semibold text-slate-800">
                {inscricaoSucesso.status === 'confirmado' ? 'Presença confirmada!' : 'Na lista de espera!'}
              </h3>
            </div>
            {inscricaoSucesso.status === 'lista_espera' && inscricaoSucesso.posicaoListaEspera && (
              <p className="text-sm text-slate-600">
                Você está na posição <strong>{inscricaoSucesso.posicaoListaEspera}ª</strong> da lista de espera.
              </p>
            )}
            <p className="text-xs text-slate-400">
              Lembre-se de fazer check-in no dia do evento via{' '}
              <a href="/checkinout" className="text-amber-600 font-medium hover:underline">Check-in/Check-out</a>.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
