import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { isDemoModeServer } from '@/lib/demo/config'
import { callRpc } from '@/lib/demo/rpcs.server'
import { storagePhotoRemove, storagePhotoUpload } from '@/lib/demo/store.server'

/** Modo demo: mesma forma de `.rpc()`/`.storage` usada por src/app/api/presenca/route.ts, sem rede nem Postgres. */
function getDemoAdmin() {
  return {
    rpc(name: string, args: Record<string, unknown> = {}) {
      return Promise.resolve(callRpc(name, args, { sessionId: null }))
    },
    storage: {
      from() {
        return {
          async upload(path: string, bytes: Buffer, opts: { contentType: string }) {
            try { storagePhotoUpload(path, bytes, opts.contentType); return { error: null } }
            catch (err) { return { error: { message: (err as Error).message } } }
          },
          async remove(paths: string[]) {
            for (const p of paths) storagePhotoRemove(p)
            return { error: null }
          },
        }
      },
    },
  }
}

// Cliente com service_role: IGNORA o RLS. Só pode ser importado em código de servidor
// (Route Handlers). O import de 'server-only' quebra o build se for parar no navegador.
export function getSupabaseAdmin() {
  if (isDemoModeServer()) return getDemoAdmin() as unknown as ReturnType<typeof createClient<Database>>
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
