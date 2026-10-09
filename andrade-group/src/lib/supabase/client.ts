'use client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { isDemoModeClient } from '@/lib/demo/config'
import { createDemoClient, type DemoClient } from '@/lib/demo/mock-client'

// Cliente do navegador: usa SOMENTE a chave publicável. Todo acesso passa pelo RLS.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Modo demo: nenhuma chave real é necessária nem usada — ver src/lib/demo/.
export const isSupabaseConfigured = isDemoModeClient() || Boolean(URL && KEY)

/** Chaves novas (sb_publishable_…) não são JWT: não podem ir no header Authorization. */
export function supabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers)
    if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization')
    headers.set('apikey', key)
    return fetch(input, { ...init, headers })
  }
}

let client: SupabaseClient<Database> | null = null
let demoClient: DemoClient | null = null

export function getSupabase(): SupabaseClient<Database> {
  if (isDemoModeClient()) {
    demoClient ??= createDemoClient()
    return demoClient as unknown as SupabaseClient<Database>
  }
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).')
  client ??= createClient<Database>(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'erp-auth' },
    global: { fetch: supabaseFetch(KEY) },
  })
  return client
}
