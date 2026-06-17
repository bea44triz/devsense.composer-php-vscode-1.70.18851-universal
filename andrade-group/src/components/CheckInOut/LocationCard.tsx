'use client'
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { GeolocationResult } from '@/hooks/useGeolocation'
import { Button } from '@/components/ui/Button'

interface LocationCardProps {
  location: GeolocationResult | null
  error: string | null
  loading: boolean
  onCapture: () => void
}

export function LocationCard({ location, error, loading, onCapture }: LocationCardProps) {
  return (
    <div className="rounded-2xl border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-amber-500 shrink-0" />
        <span className="font-semibold text-slate-800">Geolocalização</span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Obtendo localização…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {location && !error && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Localização capturada
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div className="bg-slate-50 rounded-lg p-2">
              <span className="text-slate-400 block">Latitude</span>
              <span className="font-mono font-semibold">{location.latitude.toFixed(6)}</span>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <span className="text-slate-400 block">Longitude</span>
              <span className="font-mono font-semibold">{location.longitude.toFixed(6)}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">Precisão: ±{location.accuracy.toFixed(0)}m</p>
        </div>
      )}

      {!location && !loading && (
        <Button variant="outline" size="sm" onClick={onCapture} className="w-full">
          <MapPin className="w-4 h-4" /> Capturar Localização
        </Button>
      )}
    </div>
  )
}
