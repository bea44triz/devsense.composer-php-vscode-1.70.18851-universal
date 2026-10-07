import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Cliente com service_role: IGNORA o RLS. Só pode ser importado em código de servidor
// (Route Handlers). O import de 'server-only' quebra o build se for parar no navegador.
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.')
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers)
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization')
        headers.set('apikey', key)
        return fetch(input, { ...init, headers })
      },
    },
  })
}
