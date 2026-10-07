'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Camera, CheckCircle2, CreditCard, Loader2, LocateFixed, LogIn, LogOut, MapPin, RefreshCw, SwitchCamera } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { formatCpf, isValidCpf, onlyDigits } from '@/lib/utils'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { useLoad } from '@/lib/erp/use-load'
import { haversineMeters } from '@/lib/erp/ops'
import { PublicCard, PublicShell } from '@/components/erp/PublicShell'

interface Info {
  kind: 'checkin' | 'checkout'; event_name: string; company_name: string; event_date: string; end_date: string; today: string; start_time: string | null; end_time: string | null
  location: string | null; address: string | null; event_lat: number | null; event_lng: number | null; radius_m: number; open: boolean
}
// nome vem mascarado pelo banco ("Ana T."); "não encontrado" e "não confirmado" têm a mesma resposta
interface Lookup { found?: boolean; blocked?: boolean; name?: string; team?: string; checkin_today?: boolean; open_shift?: string | null }
interface Geo { lat: number; lng: number; accuracy: number }
type Step = 'cpf' | 'confirm-person' | 'photo' | 'geo' | 'confirm' | 'done'

const btn = 'flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 font-bold text-white shadow-md shadow-amber-200 disabled:opacity-50'

export default function PresencaPage() {
  const { token } = useParams<{ token: string }>()
  const info = useLoad(async () => {
    if (!isSupabaseConfigured) return null
    const { data, error } = await getSupabase().rpc('public_presence_info', { _token: token })
    if (error) throw error
    return data as unknown as Info | null
  }, token)
  if (info.loading) return <PublicShell><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div></PublicShell>
  if (!info.data) return <PublicShell title="Link inválido"><PublicCard><p className="text-center text-sm text-slate-500">Confira o link com o coordenador.</p></PublicCard></PublicShell>
  return <Presenca token={token} info={info.data} />
}

function Presenca({ token, info }: { token: string; info: Info }) {
  const [step, setStep] = useState<Step>('cpf')
  const [cpf, setCpf] = useState('')
  const [person, setPerson] = useState<Lookup | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [geo, setGeo] = useState<Geo | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<{ recorded_at: string; inside_radius: boolean | null; address: string | null } | null>(null)
  const isIn = info.kind === 'checkin'
  const label = isIn ? 'Check-in' : 'Check-out'
  const Icon = isIn ? LogIn : LogOut

  async function findCpf() {
    setErr(null)
    if (!isValidCpf(cpf)) return setErr('CPF inválido.')
    setBusy(true)
    const { data, error } = await getSupabase().rpc('public_presence_lookup', { _token: token, _cpf: onlyDigits(cpf) })
    setBusy(false)
    if (error) return setErr(error.message)
    const l = data as unknown as Lookup
    if (l.blocked) return setErr('Muitas tentativas a partir desta conexão. Aguarde alguns minutos e tente novamente.')
    if (!l.found) return setErr('Não foi possível localizar uma participação confirmada para este CPF neste evento. Confira o CPF ou fale com o coordenador.')
    if (isIn && l.checkin_today) return setErr('Seu check-in de hoje já foi registrado.')
    if (!isIn && !l.open_shift) return setErr('Não há check-in em aberto para registrar a saída.')
    setPerson(l)
    setStep('confirm-person')
  }

  function getLocation() {
    setErr(null)
    if (!navigator.geolocation) return setErr('Seu aparelho não permite localização.')
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }); setBusy(false); setStep('confirm') },
      (e) => { setBusy(false); setErr(e.code === 1 ? 'Permita o acesso à localização para continuar.' : 'Não foi possível obter a localização. Tente novamente.') },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  async function confirm() {
    if (!photo || !geo) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/presenca', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, cpf: onlyDigits(cpf), lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy, photo }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error ?? 'Erro ao registrar.')
      setDone(j.result); setStep('done')
    } catch (x) { setErr((x as Error).message) }
    setBusy(false)
  }

  const dist = geo && info.event_lat != null && info.event_lng != null ? haversineMeters(geo.lat, geo.lng, info.event_lat, info.event_lng) : null

  return (
    <PublicShell company={info.company_name} badge={label} title={info.event_name} date={info.event_date} endDate={info.end_date} start={info.start_time} end={info.end_time} location={info.location} address={info.address}>
      <PublicCard>
        {!info.open && step !== 'done' ? (
          <p className="py-4 text-center text-sm text-slate-500">Registro de presença encerrado para este evento.</p>
        ) : step === 'cpf' ? (
          <form onSubmit={(e) => { e.preventDefault(); findCpf() }} className="space-y-4">
            <Input label="Seu CPF" placeholder="000.000.000-00" inputMode="numeric" autoFocus maxLength={14} value={formatCpf(cpf)}
              onChange={(e) => { setCpf(onlyDigits(e.target.value)); setErr(null) }} icon={<CreditCard className="h-4 w-4" />} />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button disabled={busy} className={btn}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Localizar participação</button>
            <p className="text-center text-xs text-slate-400">Vamos pedir uma foto e sua localização.</p>
          </form>
        ) : step === 'confirm-person' && person ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-500">Confirme seus dados</p>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-lg font-black text-slate-800">{person.name}</div>
              <div className="text-sm text-slate-500">Equipe {person.team}</div>
              <div className="mt-1 text-xs text-slate-400">{info.event_name}</div>
            </div>
            <button onClick={() => setStep('photo')} className={btn}>Sou eu, continuar</button>
            <button onClick={() => { setPerson(null); setStep('cpf') }} className="w-full text-sm font-semibold text-slate-400">Não sou eu</button>
          </div>
        ) : step === 'photo' ? (
          <CameraCapture onCapture={(d) => { setPhoto(d); setStep('geo') }} />
        ) : step === 'geo' ? (
          <div className="space-y-4 text-center">
            {photo && <Thumb src={photo} />}
            <p className="text-sm text-slate-500">Agora precisamos da sua localização.</p>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button onClick={getLocation} disabled={busy} className={btn}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}Obter localização</button>
          </div>
        ) : step === 'confirm' && geo ? (
          <div className="space-y-4">
            {photo && <Thumb src={photo} />}
            <div className="rounded-2xl border border-slate-100 p-3 text-sm">
              <div className="flex items-center gap-1.5 font-bold text-slate-700"><MapPin className="h-4 w-4 text-amber-500" />Localização capturada</div>
              <div className="mt-1 text-xs text-slate-400">Precisão ±{geo.accuracy} m</div>
              {dist != null && (
                <div className={`mt-2 font-semibold ${dist <= info.radius_m ? 'text-emerald-600' : 'text-red-600'}`}>
                  {dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`} do local do evento {dist <= info.radius_m ? '(no local)' : '(fora do raio)'}
                </div>
              )}
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button onClick={confirm} disabled={busy} className={btn}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{isIn ? 'Confirmar chegada' : 'Confirmar saída'}</button>
            <button onClick={() => { setPhoto(null); setStep('photo') }} className="flex w-full items-center justify-center gap-1 text-sm font-semibold text-slate-400"><RefreshCw className="h-3.5 w-3.5" />Refazer foto</button>
          </div>
        ) : step === 'done' && done ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100"><CheckCircle2 className="h-8 w-8 text-emerald-500" /></div>
            <h2 className="mt-3 text-xl font-black text-slate-800">{label} realizado{person?.name ? `, ${person.name.split(' ')[0]}` : ''}!</h2>
            <p className="mt-1 text-sm text-slate-500">{new Date(done.recorded_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
            {done.address && <p className="mx-auto mt-2 max-w-xs text-xs text-slate-400">{done.address}</p>}
            {done.inside_radius === false && <p className="mt-2 text-xs font-semibold text-red-600">Registrado fora do raio do evento. O coordenador será informado.</p>}
          </div>
        ) : null}
      </PublicCard>
    </PublicShell>
  )
}

function Thumb({ src }: { src: string }) {
  // foto local (data URL) — next/image não se aplica
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Sua foto" className="mx-auto h-28 w-28 rounded-full object-cover" />
}

function CameraCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 720 } }, audio: false })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        if (video.current) { video.current.srcObject = stream; await video.current.play(); setReady(true); setError(null) }
      } catch { if (!cancelled) setError('Permita o acesso à câmera para tirar a foto.') }
    })()
    return () => { cancelled = true; setReady(false); stream?.getTracks().forEach((t) => t.stop()) }
  }, [facing])

  function snap() {
    const v = video.current
    if (!v || !v.videoWidth) return
    const size = Math.min(v.videoWidth, v.videoHeight)
    const c = document.createElement('canvas')
    c.width = 480; c.height = 480
    c.getContext('2d')?.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, 480, 480)
    onCapture(c.toDataURL('image/jpeg', 0.75))
  }

  return (
    <div className="space-y-3 text-center">
      <p className="text-sm font-semibold text-slate-600">Tire uma foto sua para validar a presença</p>
      <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-3xl bg-black">
        <video ref={video} playsInline muted className={`h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />
        <button type="button" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} aria-label="Trocar câmera"
          className="absolute bottom-3 right-3 rounded-full bg-black/50 p-2 text-white"><SwitchCamera className="h-5 w-5" /></button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={snap} disabled={!ready} className={btn}><Camera className="h-5 w-5" />Tirar foto</button>
    </div>
  )
}
