'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input }  from '@/components/ui/Input'
import { CheckCircle2, CreditCard, Camera, MapPin, LogOut } from 'lucide-react'
import { Evento } from '@/types'

type Step = 'form' | 'camera' | 'gps' | 'confirmacao' | 'sucesso'

export default function CheckoutPage() {
  const { eventoId } = useParams() as { eventoId: string }
  const [evento, setEvento]   = useState<Evento | null>(null)
  const [step, setStep]       = useState<Step>('form')
  const [cpf, setCpf]         = useState('')
  const [foto, setFoto]       = useState<string | null>(null)
  const [lat, setLat]         = useState<number | null>(null)
  const [lng, setLng]         = useState<number | null>(null)
  const [accuracy, setAcc]    = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState<string | null>(null)
  const [resultado, setRes]   = useState<{ timestamp: string; nome: string; local: string } | null>(null)

  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    fetch(`/api/eventos/${eventoId}`).then(r => r.json()).then(d => { if (d.success) setEvento(d.data) })
  }, [eventoId])

  const iniciarCamera = async () => {
    setErro(null); setStep('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setErro('Não foi possível acessar a câmera.')
      setStep('form')
    }
  }

  const tirarFoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    setFoto(canvas.toDataURL('image/jpeg', 0.7))
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setStep('gps')
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setAcc(pos.coords.accuracy); setStep('confirmacao') },
      () => { setErro('Não foi possível capturar localização. Ative o GPS.'); setStep('form') },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const handleSubmit = async () => {
    if (lat == null || lng == null) return
    setLoading(true); setErro(null)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipoRegistro: 'checkout', cpf, eventoId, latitude: lat, longitude: lng, accuracy }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao registrar.')
      setRes({ timestamp: data.data.timestamp, nome: data.data.nome, local: data.data.localRegistro ?? '' })
      setStep('sucesso')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  const nomeFmt = resultado?.nome ? `, ${resultado.nome}` : ''
  const dataFmt = resultado ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(resultado.timestamp)) : ''

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-800 text-white px-5 pt-12 pb-6 shadow">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-lg">Check-out</h1>
            <p className="text-slate-300 text-xs">{evento?.titulo ?? 'Carregando…'}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-4">

        {step === 'sucesso' && resultado && (
          <div className="flex flex-col items-center gap-4 py-12 text-center animate-slide-up">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-800">Check-out feito{nomeFmt}!</h2>
            <p className="text-slate-500 text-sm">{dataFmt}</p>
            {resultado.local && (
              <p className="text-xs text-slate-400 max-w-xs text-center flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                {resultado.local}
              </p>
            )}
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <Input label="Seu CPF" placeholder="000.000.000-00" value={cpf}
                onChange={e => setCpf(e.target.value)} inputMode="numeric"
                icon={<CreditCard className="w-4 h-4" />} />
            </div>
            {erro && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{erro}</p>}
            <Button size="lg" variant="secondary" onClick={() => { if (!cpf.trim()) { setErro('Informe seu CPF.'); return } iniciarCamera() }}>
              <Camera className="w-5 h-5" /> Continuar
            </Button>
            <p className="text-xs text-slate-400 text-center">Será solicitado acesso à câmera e localização GPS</p>
          </div>
        )}

        {step === 'camera' && (
          <div className="space-y-3 animate-slide-up">
            <p className="text-sm font-semibold text-slate-600 text-center">Tire uma foto para encerrar sua jornada</p>
            <div className="rounded-2xl overflow-hidden bg-black aspect-video">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            </div>
            <Button size="lg" variant="secondary" onClick={tirarFoto}>
              <Camera className="w-5 h-5" /> Capturar foto
            </Button>
          </div>
        )}

        {step === 'gps' && (
          <div className="flex flex-col items-center gap-4 py-12 text-center animate-slide-up">
            <MapPin className="w-10 h-10 text-slate-500 animate-bounce" />
            <p className="font-semibold text-slate-600">Capturando sua localização…</p>
          </div>
        )}

        {step === 'confirmacao' && foto && (
          <div className="space-y-4 animate-slide-up">
            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="Foto capturada" className="w-full aspect-video object-cover" />
            </div>
            {lat && lng && (
              <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium">
                <MapPin className="w-4 h-4 text-emerald-500" />
                Localização capturada · Ver no Maps
              </a>
            )}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-400 text-xs">CPF</span><span className="font-mono font-semibold text-xs">{cpf}</span></div>
              <div className="flex justify-between mt-1.5"><span className="text-slate-400 text-xs">Tipo</span><span className="font-semibold text-xs">Check-out</span></div>
            </div>
            {erro && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{erro}</p>}
            <Button size="lg" variant="secondary" loading={loading} onClick={handleSubmit}>
              <LogOut className="w-5 h-5" /> Confirmar check-out
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
