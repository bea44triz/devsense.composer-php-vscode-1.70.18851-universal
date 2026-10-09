'use client'
// Substituto do @supabase/supabase-js usado no navegador quando o modo demo está ativo. Implementa só o
// subconjunto da API realmente chamado pelo app (ver MAPA_DO_PROJETO.md) e fala com o armazém local do
// servidor via src/app/api/demo/route.ts — por isso duas abas do navegador (gestor e freelancer) enxergam
// os mesmos dados, exatamente como aconteceria contra um Supabase de verdade.
// Tipos duplicados (não importados de query.server.ts, que é 'server-only') para não arriscar
// que o bundler do navegador puxe código de servidor por causa de um import de tipo.
type FilterOp = 'eq' | 'in' | 'like' | 'ilike'
interface Filter { op: FilterOp; col: string; val: unknown }
interface FromRequest {
  table: string
  filters: Filter[]
  order?: { col: string; ascending: boolean }
  limit?: number
  mode: 'many' | 'maybeSingle' | 'single'
  write?: { kind: 'update'; patch: Record<string, unknown> } | { kind: 'insert'; rows: Record<string, unknown>[] }
  wantsSelect: boolean
}

interface Resp<T> { data: T; error: { message: string; code?: string } | null }

async function gateway<T>(body: Record<string, unknown>): Promise<Resp<T>> {
  const r = await fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok && r.status !== 400) return { data: null as T, error: { message: 'Modo demo indisponível. Reinicie com npm run dev:demo.' } }
  return (await r.json()) as Resp<T>
}

class DemoQuery<T = unknown> implements PromiseLike<Resp<T>> {
  private filters: Filter[] = []
  private _order?: { col: string; ascending: boolean }
  private _limit?: number
  private _mode: FromRequest['mode'] = 'many'
  private _write?: FromRequest['write']
  private _wantsSelect = false

  constructor(private table: string) {}

  select() { this._wantsSelect = true; return this }
  eq(col: string, val: unknown) { this.filters.push({ op: 'eq', col, val }); return this }
  in(col: string, val: unknown[]) { this.filters.push({ op: 'in', col, val }); return this }
  like(col: string, val: string) { this.filters.push({ op: 'like', col, val }); return this }
  ilike(col: string, val: string) { this.filters.push({ op: 'ilike', col, val }); return this }
  order(col: string, opts?: { ascending?: boolean }) { this._order = { col, ascending: opts?.ascending !== false }; return this }
  limit(n: number) { this._limit = n; return this }
  maybeSingle() { this._mode = 'maybeSingle'; return this }
  single() { this._mode = 'single'; return this }
  update(patch: Record<string, unknown>) { this._write = { kind: 'update', patch }; return this }
  insert(row: Record<string, unknown> | Record<string, unknown>[]) {
    this._write = { kind: 'insert', rows: Array.isArray(row) ? row : [row] }
    return this
  }

  private exec(): Promise<Resp<T>> {
    const req: FromRequest = {
      table: this.table, filters: this.filters, order: this._order, limit: this._limit,
      mode: this._mode, write: this._write, wantsSelect: this._wantsSelect,
    }
    return gateway<T>({ op: 'from', ...req })
  }

  then<R1 = Resp<T>, R2 = never>(
    onfulfilled?: ((value: Resp<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.exec().then(onfulfilled, onrejected)
  }
}

type AuthListener = (event: 'SIGNED_IN' | 'SIGNED_OUT') => void
const listeners = new Set<AuthListener>()

export function createDemoClient() {
  return {
    from(table: string) { return new DemoQuery(table) },
    rpc(name: string, args: Record<string, unknown> = {}) {
      return gateway({ op: 'rpc', name, args })
    },
    storage: {
      from() {
        return {
          async createSignedUrl(path: string) {
            const res = await gateway<{ signedUrl: string } | null>({ op: 'storage', action: 'createSignedUrl', path })
            return { data: res.data, error: res.error }
          },
        }
      },
    },
    auth: {
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const res = await gateway<{ user: { id: string; email: string } | null }>({ op: 'auth', action: 'signIn', email, password })
        if (!res.error) listeners.forEach((l) => l('SIGNED_IN'))
        return res
      },
      async getUser() {
        return gateway<{ user: { id: string; email: string } | null }>({ op: 'auth', action: 'getUser' })
      },
      async signOut() {
        const res = await gateway({ op: 'auth', action: 'signOut' })
        listeners.forEach((l) => l('SIGNED_OUT'))
        return res
      },
      onAuthStateChange(cb: AuthListener) {
        listeners.add(cb)
        return { data: { subscription: { unsubscribe() { listeners.delete(cb) } } } }
      },
    },
  }
}

export type DemoClient = ReturnType<typeof createDemoClient>
