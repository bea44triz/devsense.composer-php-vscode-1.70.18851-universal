'use client'
import { useState } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { CameraCapture } from '@/components/CheckInOut/CameraCapture'
import { LocationCard } from '@/components/CheckInOut/LocationCard'
import { AppShell } from '@/components/Layout/AppShell'
import { PageHeader } from '@/components/Layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardSection } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import {
  CheckCircle2, LogIn, LogOut, Camera,
  Hash, CalendarDays, ArrowRight,
} from 'lucide-react'

type Step = 'form' | 'localizacao' | 'camera' | 'confirmacao' | 'sucesso'
type Tipo = 'checkin' | 'checkout'

export default function CheckInOutPage() {
  const [step, setStep]             = useState<Step>('form')
  const [tipo, setTipo]             = useState<Tipo>('checkin')
  const [freelancerId, setFId]      = useState('')
  const [eventoId, setEId]          = useState('')
  const [foto, setFoto]             = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [formError, setFormError]   = useState<string | null>(null)
  const [resultado, setResultado]   = useState<{ timestamp: string } | null>(null)

  const { location, error: geoError, loading: geoLoading, capture: captureLocation } = useGeolocation()

  const handleStart = async () => {
    if (!freelancerId.trim() || !eventoId.trim()) {
      setFormError('Preencha seu ID de freelancer e o ID do evento.')
      return
    }
    setFormError(null)
    setStep('localizacao')
    await captureLocation()
    setStep('camera')
  }

  const handleFoto = (img: string) => {
    setFoto(img)
    setStep('confirmacao')
  }

  const handleSubmit = async () => {
    if (!location || !foto) return
    setLoading(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, freelancerId, eventoId,
          latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy, foto }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao registrar.')
      setResultado({ timestamp: data.data.timestamp })
      setStep('sucesso')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setStep('form'); setFoto(null); setSubmitError(null); setResultado(null) }

  return (
    <AppShell>
      <PageHeader
        title={tipo === 'checkin' ? 'Check-in' : 'Check-out'}
        subtitle="Andrade Group"
        backHref="/"
      />

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-4">

        {/* ── Sucesso ── */}
        {step === 'sucesso' && resultado && (
          <div className="animate-slide-up flex flex-col items-center gap-6 py-12 text-center">
            <div className="animate-pulse-ring w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">
                {tipo === 'checkin' ? 'Check-in feito!' : 'Check-out feito!'}
              </h2>
              <p className="text-slate-500 text-sm mt-1.5">
                {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(resultado.timestamp))}
              </p>
            </div>
            <Button variant="outline" onClick={reset} className="w-full max-w-xs">
              Novo registro
            </Button>
          </div>
        )}

        {/* ── Formulário ── */}
        {step === 'form' && (
          <div className="animate-slide-up space-y-4">
            {/* Toggle tipo */}
            <div className="bg-white rounded-2xl p-1.5 flex gap-1 shadow-sm border border-slate-100">
              {(['checkin', 'checkout'] as Tipo[]).map((t) => (
                <button key={t} onClick={() => setTipo(t)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all
                    ${tipo === t ? 'bg-amber-500 text-white shadow' : 'text-slate-400 hover:text-slate-600'}`}>
                  {t === 'checkin' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                  {t === 'checkin' ? 'Check-in' : 'Check-out'}
                </button>
              ))}
            </div>

            <Card>
              <CardSection title="Identificação">
                <Input label="ID do Freelancer" placeholder="ID recebido no cadastro"
                  value={freelancerId} onChange={(e) => setFId(e.target.value)}
                  icon={<Hash className="w-4 h-4" />} />
                <Input label="ID do Evento" placeholder="ID do evento"
                  value={eventoId} onChange={(e) => setEId(e.target.value)}
                  icon={<CalendarDays className="w-4 h-4" />} />
              </CardSection>
            </Card>

            {formError && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                {formError}
              </p>
            )}

            <Button size="lg" onClick={handleStart}>
              <Camera className="w-5 h-5" />
              Iniciar {tipo === 'checkin' ? 'Check-in' : 'Check-out'}
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>

            <p className="text-xs text-slate-400 text-center">
              Será solicitado acesso à câmera e localização GPS
            </p>
          </div>
        )}

        {/* ── GPS ── */}
        {step === 'localizacao' && (
          <div className="animate-slide-up space-y-4">
            <p className="text-center text-sm font-medium text-slate-500">Capturando sua localização…</p>
            <LocationCard location={location} error={geoError} loading={geoLoading} onCapture={captureLocation} />
          </div>
        )}

        {/* ── Câmera ── */}
        {step === 'camera' && (
          <div className="animate-slide-up space-y-4">
            {location && <LocationCard location={location} error={geoError} loading={geoLoading} onCapture={captureLocation} />}
            <Card padding="sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 pt-1 mb-3">
                Foto de validação
              </p>
              <CameraCapture onCapture={handleFoto} onCancel={() => setStep('form')} />
            </Card>
          </div>
        )}

        {/* ── Confirmação ── */}
        {step === 'confirmacao' && foto && (
          <div className="animate-slide-up space-y-4">
            <LocationCard location={location} error={geoError} loading={geoLoading} onCapture={captureLocation} />

            <Card padding="none">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Foto capturada</p>
                <button onClick={() => setStep('camera')} className="text-xs text-amber-600 font-semibold hover:underline">
                  Refazer
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="Validação" className="w-full aspect-video object-cover" />
            </Card>

            <Card>
              <div className="space-y-2 text-sm">
                {[
                  ['Tipo',          tipo === 'checkin' ? 'Check-in' : 'Check-out'],
                  ['Freelancer ID', freelancerId],
                  ['Evento ID',     eventoId],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center">
                    <span className="text-slate-400 text-xs font-medium">{k}</span>
                    <span className="font-semibold text-slate-800 text-xs font-mono">{v}</span>
                  </div>
                ))}
              </div>
            </Card>

            {submitError && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                {submitError}
              </p>
            )}

            <Button size="lg" loading={loading} onClick={handleSubmit}>
              {tipo === 'checkin' ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
              Confirmar {tipo === 'checkin' ? 'Check-in' : 'Check-out'}
            </Button>
          </div>
        )}
      </main>
    </AppShell>
  )
}
