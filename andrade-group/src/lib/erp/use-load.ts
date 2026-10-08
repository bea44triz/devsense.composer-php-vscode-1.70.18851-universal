'use client'
import { useCallback, useEffect, useEffectEvent, useState } from 'react'

/**
 * Carrega dados assíncronos; recarrega quando `key` muda. `reload()` refaz a consulta.
 * Durante a recarga, `data` mantém o último resultado (evita piscar a tela).
 * `enabled: false` (ex.: aba ainda fechada) não dispara a consulta.
 */
export function useLoad<T>(fn: () => Promise<T>, key: string, opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true
  const [nonce, setNonce] = useState(0)
  const [res, setRes] = useState<{ k: string; data: T | undefined; error: string | null } | null>(null)
  const run = useEffectEvent(fn)
  const current = `${key}#${nonce}`

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    run()
      .then((data) => { if (!cancelled) setRes({ k: current, data, error: null }) })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err)
        if (!cancelled) setRes((r) => ({ k: current, data: r?.data, error: msg }))
      })
    return () => { cancelled = true }
  }, [current, enabled])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const loading = enabled && res?.k !== current
  return { data: res?.data, error: loading ? null : (res?.error ?? null), loading, reload }
}
