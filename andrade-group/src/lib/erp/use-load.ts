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

  // Não há assinatura em tempo real (nem aqui, nem contra o Supabase real): uma tela aberta antes de
  // outra pessoa/aba gravar algo (ex.: freelancer se inscrevendo pelo link público) só volta a bater
  // no servidor quando o usuário troca de filtro/aba localmente — o que NÃO refaz a consulta, já que
  // esses controles só reorganizam os dados já carregados. Para não parecer "dado sumiu": recarrega
  // ao voltar o foco para a janela/aba, e também por garantia a cada poucos segundos (o filtro/aba
  // trocados localmente não fazem o fetch sozinhos, então sem isso a tela fica presa no 1º carregamento).
  useEffect(() => {
    if (!enabled) return
    const onFocus = () => reload()
    const onVisibility = () => { if (document.visibilityState === 'visible') reload() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    const poll = setInterval(() => { if (document.visibilityState === 'visible') reload() }, 6000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(poll)
    }
  }, [enabled, reload])

  const loading = enabled && res?.k !== current
  return { data: res?.data, error: loading ? null : (res?.error ?? null), loading, reload }
}
