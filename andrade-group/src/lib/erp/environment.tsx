'use client'
// Portado do projeto Lovable (src/lib/environment.tsx): resolve tenant, empresas do usuário e ambiente atual.
// Toda a autorização real acontece no banco (RLS); aqui só se decide o que mostrar.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { ENV_STORAGE_KEY, TENANT_STORAGE_KEY, readTenantHint } from '@/lib/erp/tenant'
import { canWrite, type CompanyCtx, type Environment } from '@/lib/erp/environment-rules'

export interface Tenant { id: string; name: string; slug: string }

export type EnvStatus = 'not-configured' | 'loading' | 'no-session' | 'ready' | 'denied' | 'choose' | 'no-access'

interface EnvState {
  status: EnvStatus
  userId: string | null
  email: string | null
  isPlatformAdmin: boolean
  isGroupAdmin: boolean
  tenant: Tenant | null
  tenantOptions: Tenant[]
  companies: CompanyCtx[]
  consolidatedAllowed: boolean
  env: Environment | null
  currentCompany: CompanyCtx | undefined
  writable: boolean
  setEnv: (e: Environment) => void
  chooseTenant: (slug: string) => void
  signOut: () => Promise<void>
  reload: () => void
}

const Ctx = createContext<EnvState | null>(null)

function safeSession(): Storage | null {
  try { return window.sessionStorage } catch { return null }
}

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<EnvStatus>(isSupabaseConfigured ? 'loading' : 'not-configured')
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [isPlatformAdmin, setPA] = useState(false)
  const [isGroupAdmin, setGA] = useState(false)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [tenantOptions, setTenantOptions] = useState<Tenant[]>([])
  const [companies, setCompanies] = useState<CompanyCtx[]>([])
  const [consolidatedAllowed, setConsolidated] = useState(false)
  const [env, setEnvState] = useState<Environment | null>(null)
  const [nonce, setNonce] = useState(0)

  // Recarrega o contexto quando a sessão muda (login/logout em outra aba, expiração)
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setNonce((n) => n + 1)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    const supabase = getSupabase()
    const store = safeSession()
    ;(async () => {
      setStatus('loading')
      const { data: u } = await supabase.auth.getUser()
      if (cancelled) return
      if (!u.user) { setUserId(null); setStatus('no-session'); return }
      setUserId(u.user.id)
      setEmail(u.user.email ?? null)
      const { data: pa } = await supabase.rpc('is_platform_admin')
      setPA(!!pa)

      const hint = readTenantHint(window.location.hostname, window.location.search, store?.getItem(TENANT_STORAGE_KEY) ?? null)
      let t: Tenant | null = null
      if (hint.kind === 'domain' || hint.kind === 'slug') {
        const { data } = await supabase.rpc('resolve_tenant',
          hint.kind === 'domain' ? { _host: hint.host } : { _host: '', _slug: hint.slug })
        t = (data as Tenant[] | null)?.[0] ?? null
        if (!t) {
          // "não existe" e "sem acesso" têm a mesma resposta: tenants não são revelados
          store?.removeItem(TENANT_STORAGE_KEY)
          if (!cancelled) { setTenant(null); setStatus('denied') }
          return
        }
      } else {
        const { data } = await supabase.rpc('my_tenants')
        const list = (data as Tenant[] | null) ?? []
        if (list.length === 0) { if (!cancelled) setStatus('no-access'); return }
        if (list.length > 1) { if (!cancelled) { setTenantOptions(list); setStatus('choose') } return }
        t = list[0] ?? null
      }
      if (!t || cancelled) return
      if (hint.kind !== 'domain') store?.setItem(TENANT_STORAGE_KEY, t.slug)

      const [{ data: comps }, { data: cons }, { data: ga }] = await Promise.all([
        supabase.rpc('my_company_context', { _group_id: t.id }),
        supabase.rpc('can_view_consolidated', { _group_id: t.id }),
        supabase.rpc('is_group_admin', { _group_id: t.id }),
      ])
      if (cancelled) return
      const list = (comps as CompanyCtx[] | null) ?? []
      setTenant(t)
      setCompanies(list)
      setConsolidated(!!cons)
      setGA(!!ga)

      // restaura o ambiente salvo somente se ainda for válido
      let next: Environment | null = null
      try {
        const saved = JSON.parse(store?.getItem(ENV_STORAGE_KEY) ?? 'null') as Environment | null
        if (saved?.mode === 'consolidated' && cons) next = saved
        if (saved?.mode === 'company' && list.some((c) => c.company_id === saved.companyId)) next = saved
      } catch { /* ignora */ }
      const first = list[0]
      if (!next && first) next = { mode: 'company', companyId: first.company_id }
      setEnvState(next)
      setStatus(list.length === 0 ? 'no-access' : 'ready')
    })()
    return () => { cancelled = true }
  }, [nonce])

  const setEnv = useCallback((e: Environment) => {
    setEnvState(e)
    safeSession()?.setItem(ENV_STORAGE_KEY, JSON.stringify(e))
  }, [])

  const chooseTenant = useCallback((slug: string) => {
    safeSession()?.setItem(TENANT_STORAGE_KEY, slug)
    safeSession()?.removeItem(ENV_STORAGE_KEY)
    setNonce((n) => n + 1)
  }, [])

  const signOut = useCallback(async () => {
    safeSession()?.removeItem(TENANT_STORAGE_KEY)
    safeSession()?.removeItem(ENV_STORAGE_KEY)
    await getSupabase().auth.signOut()
  }, [])

  const value = useMemo<EnvState>(() => {
    const currentCompany = env?.mode === 'company' ? companies.find((c) => c.company_id === env.companyId) : undefined
    return {
      status, userId, email, isPlatformAdmin, isGroupAdmin, tenant, tenantOptions, companies,
      consolidatedAllowed, env, currentCompany, writable: canWrite(env) && !!currentCompany,
      setEnv, chooseTenant, signOut, reload: () => setNonce((n) => n + 1),
    }
  }, [status, userId, email, isPlatformAdmin, isGroupAdmin, tenant, tenantOptions, companies, consolidatedAllowed, env, setEnv, chooseTenant, signOut])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useEnvironment() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useEnvironment fora do EnvironmentProvider')
  return v
}

/** Escopo de dados da tela: empresa atual ou todas do consolidado (somente leitura). */
export function useScope() {
  const { env, companies, currentCompany, writable } = useEnvironment()
  const ids = env?.mode === 'consolidated' ? companies.map((c) => c.company_id) : currentCompany ? [currentCompany.company_id] : []
  const has = (p: CompanyCtx['permissions'][number]) =>
    !!currentCompany && (currentCompany.permissions.includes('empresa.admin') || currentCompany.permissions.includes(p))
  return {
    ids,
    companyName: (id: string) => companies.find((c) => c.company_id === id)?.name ?? '',
    consolidated: env?.mode === 'consolidated',
    companyId: currentCompany?.company_id ?? null,
    canOperate: writable && has('operacao.gerenciar'),
    canFinance: writable && has('financeiro.gerenciar'),
    /** vê/gere todas as operações da empresa (sem isso, só as vinculadas a ele) */
    canSeeAll: writable && has('operacao.todos'),
    /** cadastra clientes, centros de custo e fornecedores (mesma regra do banco: can_manage_registry) */
    canRegistry: writable && ((has('operacao.gerenciar') && has('operacao.todos')) || has('financeiro.gerenciar')),
    /** dados financeiros completos (PIX inteiro) */
    canSeeFinanceData: has('financeiro.ver') || has('financeiro.gerenciar'),
  }
}
