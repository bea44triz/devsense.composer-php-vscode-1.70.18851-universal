'use client'
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { GeolocationResult } from '@/hooks/useGeolocation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface LocationCardProps {
  location: GeolocationResult | null
  error: string | null
  loading: boolean
  onCapture: () => void
}

export function LocationCard({ location, error, loading, onCapture }: LocationCardProps) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <MapPin className="w-4 h-4 text-amber-600" />
        </div>
        <span className="text-sm font-bold text-slate-700">Geolocalização</span>
      </div>

      {loading && (
        <div className="flex items-center gap-2.5 text-slate-500 text-sm py-1">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          Obtendo localização GPS…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {location && !error && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Localização capturada com sucesso
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Latitude',  location.latitude.toFixed(6)],
              ['Longitude', location.longitude.toFixed(6)],
            ].map(([label, val]) => (
              <div key={label} className="bg-slate-50 rounded-xl p-2.5">
                <p className="text-[10px] text-slate-400 font-medium">{label}</p>
                <p className="font-mono text-xs font-bold text-slate-700 mt-0.5">{val}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">Precisão: ±{location.accuracy.toFixed(0)} m</p>
        </div>
      )}

      {!location && !loading && (
        <Button variant="outline" size="sm" onClick={onCapture} className="w-full">
          <MapPin className="w-4 h-4" /> Capturar localização
        </Button>
      )}
    </Card>
  )
}
