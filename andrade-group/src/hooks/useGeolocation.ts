'use client'
import { useState, useCallback } from 'react'

export interface GeolocationResult {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

interface UseGeolocationReturn {
  location: GeolocationResult | null
  error: string | null
  loading: boolean
  capture: () => Promise<GeolocationResult | null>
}

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<GeolocationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const capture = useCallback((): Promise<GeolocationResult | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError('Geolocalização não suportada neste dispositivo.')
        resolve(null)
        return
      }

      setLoading(true)
      setError(null)

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const result: GeolocationResult = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          }
          setLocation(result)
          setLoading(false)
          resolve(result)
        },
        (err) => {
          const messages: Record<number, string> = {
            1: 'Permissão de localização negada. Habilite nas configurações do navegador.',
            2: 'Posição indisponível. Verifique o GPS do dispositivo.',
            3: 'Tempo esgotado ao obter localização.',
          }
          setError(messages[err.code] ?? 'Erro desconhecido ao obter localização.')
          setLoading(false)
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  }, [])

  return { location, error, loading, capture }
}
