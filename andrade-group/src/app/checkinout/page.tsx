'use client'
import { useState } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { CameraCapture } from '@/components/CheckInOut/CameraCapture'
import { LocationCard } from '@/components/CheckInOut/LocationCard'
import { PageHeader } from '@/components/Layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CheckCircle2, LogIn, LogOut, Camera } from 'lucide-react'

type Step = 'form' | 'localizacao' | 'camera' | 'confirmacao' | 'sucesso'
type Tipo = 'checkin' | 'checkout'

export default function CheckInOutPage() {
  const [step, setStep] = useState<Step>('form')
  const [tipo, setTipo] = useState<Tipo>('checkin')
  const [freelancerId, setFreelancerId] = useState('')
  const [eventoId, setEventoId] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ timestamp: string } | null>(null)

  const { location, error: geoError, loading: geoLoading, capture: captureLocation } = useGeolocation()

  const handleStartCapture = async () => {
    if (!freelancerId.trim() || !eventoId.trim()) {
      setError('Preencha seu ID de freelancer e o ID do evento.')
      return
    }
    setError(null)
    setStep('localizacao')
    await captureLocation()
    setStep('camera')
  }

  const handleFotoCapturada = (imageDataUrl: string) => {
    setFoto(imageDataUrl)
    setStep('confirmacao')
  }

  const handleSubmit = async () => {
    if (!location || !foto) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          freelancerId,
          eventoId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          foto,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Erro ao registrar.')

      setResultado({ timestamp: data.data.timestamp })
      setStep('sucesso')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  const handleReiniciar = () => {
    setStep('form')
    setFoto(null)
    setError(null)
    setResultado(null)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <PageHeader
        title={tipo === 'checkin' ? 'Check-in' : 'Check-out'}
        subtitle="Andrade Group"
        backHref="/"
      />

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-5">

        {/* ── Sucesso ── */}
        {step === 'sucesso' && resultado && (
          <div className="flex flex-col items-center gap-5 py-10 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {tipo === 'checkin' ? 'Check-in realizado!' : 'Check-out realizado!'}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Registrado em{' '}
                {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(
                  new Date(resultado.timestamp)
                )}
              </p>
            </div>
            <Button size="lg" variant="outline" onClick={handleReiniciar}>
              Novo registro
            </Button>
          </div>
        )}

        {/* ── Formulário inicial ── */}
        {step === 'form' && (
          <>
            {/* Seletor Check-in / Check-out */}
            <div className="bg-white rounded-2xl p-1 flex gap-1 shadow-sm">
              {(['checkin', 'checkout'] as Tipo[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                    tipo === t
                      ? 'bg-amber-500 text-white shadow'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {t === 'checkin' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                  {t === 'checkin' ? 'Check-in' : 'Check-out'}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <Input
                label="Seu ID de Freelancer"
                placeholder="Ex: 1718123456-abc123"
                value={freelancerId}
                onChange={(e) => setFreelancerId(e.target.value)}
              />
              <Input
                label="ID do Evento"
                placeholder="Ex: 1718000000-xyz789"
                value={eventoId}
                onChange={(e) => setEventoId(e.target.value)}
              />

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>
              )}
            </div>

            <Button size="lg" onClick={handleStartCapture}>
              <Camera className="w-5 h-5" />
              Iniciar {tipo === 'checkin' ? 'Check-in' : 'Check-out'}
            </Button>

            <p className="text-xs text-slate-400 text-center">
              Será solicitado acesso à câmera e localização GPS.
            </p>
          </>
        )}

        {/* ── Captura de localização ── */}
        {step === 'localizacao' && (
          <>
            <p className="text-slate-600 text-sm text-center font-medium">
              Aguarde enquanto capturamos sua localização…
            </p>
            <LocationCard
              location={location}
              error={geoError}
              loading={geoLoading}
              onCapture={captureLocation}
            />
          </>
        )}

        {/* ── Câmera ── */}
        {step === 'camera' && (
          <>
            {location && (
              <LocationCard
                location={location}
                error={geoError}
                loading={geoLoading}
                onCapture={captureLocation}
              />
            )}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-700 mb-3">
                Tire uma foto para validação
              </p>
              <CameraCapture
                onCapture={handleFotoCapturada}
                onCancel={() => setStep('form')}
              />
            </div>
          </>
        )}

        {/* ── Confirmação ── */}
        {step === 'confirmacao' && foto && (
          <>
            <LocationCard
              location={location}
              error={geoError}
              loading={geoLoading}
              onCapture={captureLocation}
            />

            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 pt-4 pb-2">
                <p className="text-sm font-semibold text-slate-700">Foto de validação</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="Foto de validação" className="w-full aspect-video object-cover" />
              <div className="p-4">
                <button
                  onClick={() => setStep('camera')}
                  className="text-sm text-amber-600 hover:underline font-medium"
                >
                  Refazer foto
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm text-sm text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Tipo</span>
                <span className="font-semibold capitalize">{tipo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Freelancer ID</span>
                <span className="font-mono text-xs">{freelancerId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Evento ID</span>
                <span className="font-mono text-xs">{eventoId}</span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>
            )}

            <Button size="lg" loading={loading} onClick={handleSubmit}>
              {tipo === 'checkin' ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
              Confirmar {tipo === 'checkin' ? 'Check-in' : 'Check-out'}
            </Button>
          </>
        )}
      </main>
    </div>
  )
}
