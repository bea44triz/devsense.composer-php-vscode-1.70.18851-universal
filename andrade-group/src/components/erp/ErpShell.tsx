'use client'
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, ChevronDown, Layers, LayoutDashboard, CalendarDays, Briefcase, Wallet, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EnvironmentProvider, useEnvironment } from '@/lib/erp/environment'
import { NAV } from './nav'
import { Spinner } from './ui'

export function ErpShell({ children }: { children: ReactNode }) {
  return (
    <EnvironmentProvider>
      <Gate>{children}</Gate>
    </EnvironmentProvider>
  )
}

function CenterCard({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-black text-slate-800">{title}</h1>
        {children && <div className="mt-2 space-y-3 text-sm text-slate-500">{children}</div>}
      </div>
    </div>
  )
}

function Gate({ children }: { children: ReactNode }) {
  const env = useEnvironment()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (env.status === 'no-session') router.replace(`/entrar?next=${encodeURIComponent(pathname)}`)
  }, [env.status, pathname, router])

  switch (env.status) {
    case 'not-configured':
      return (
        <CenterCard title="ERP ainda não conectado ao Supabase">
          <p>Defina <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.</p>
          <p>O sistema anterior continua disponível em <Link className="font-semibold text-amber-600 underline" href="/gerenciador/eventos">/gerenciador/eventos</Link>.</p>
        </CenterCard>
      )
    case 'loading':
    case 'no-session':
      return <div className="min-h-screen bg-slate-50"><Spinner /></div>
    case 'denied':
      // mesma mensagem para "não existe" e "sem acesso": não revela outros clientes
      return (
        <CenterCard title="Acesso não disponível">
          <p>Seu usuário não tem acesso a este endereço.</p>
          <button onClick={env.signOut} className="font-semibold text-amber-600 underline">Entrar com outro usuário</button>
        </CenterCard>
      )
    case 'no-access':
      return (
        <CenterCard title="Nenhuma empresa vinculada">
          <p>O usuário <b>{env.email}</b> ainda não foi vinculado a nenhuma empresa. Peça ao administrador.</p>
          <button onClick={env.signOut} className="font-semibold text-amber-600 underline">Sair</button>
        </CenterCard>
      )
    case 'choose':
      return (
        <CenterCard title="Escolha o cliente">
          <div className="space-y-2 pt-2">
            {env.tenantOptions.map((t) => (
              <button key={t.id} onClick={() => env.chooseTenant(t.slug)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700 hover:border-amber-400">
                {t.name}
              </button>
            ))}
          </div>
        </CenterCard>
      )
    case 'ready':
      return <Frame>{children}</Frame>
  }
}

function AmbienteSwitcher({ dark }: { dark?: boolean }) {
  const { companies, env, setEnv, consolidatedAllowed, tenant } = useEnvironment()
  const [open, setOpen] = useState(false)
  const current = env?.mode === 'consolidated' ? `Consolidado ${tenant?.name.replace(/^Grupo\s+/, '') ?? ''}` : companies.find((c) => env?.mode === 'company' && c.company_id === env.companyId)?.name
  const options = companies.length + (consolidatedAllowed ? 1 : 0)
  if (options <= 1) {
    return (
      <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold', dark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700')}>
        <Building2 className="h-4 w-4 text-amber-500" /> {current}
      </div>
    )
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Trocar ambiente"
        className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold', dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}>
        {env?.mode === 'consolidated' ? <Layers className="h-4 w-4 text-amber-500" /> : <Building2 className="h-4 w-4 text-amber-500" />}
        <span className="max-w-[11rem] truncate">{current}</span>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-100 bg-white p-1.5 text-slate-700 shadow-xl">
          <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Ambiente</div>
          {companies.map((c) => (
            <button key={c.company_id} onClick={() => { setEnv({ mode: 'company', companyId: c.company_id }); setOpen(false) }}
              className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-slate-50',
                env?.mode === 'company' && env.companyId === c.company_id && 'bg-amber-50 text-amber-800')}>
              <Building2 className="h-4 w-4" /> {c.name}
            </button>
          ))}
          {consolidatedAllowed && (
            <button onClick={() => { setEnv({ mode: 'consolidated' }); setOpen(false) }}
              className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-slate-50',
                env?.mode === 'consolidated' && 'bg-amber-50 text-amber-800')}>
              <Layers className="h-4 w-4" /> Consolidado <span className="ml-auto text-[10px] font-bold uppercase text-slate-400">consulta</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {NAV.map((sec) => (
        <div key={sec.title}>
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{sec.title}</div>
          <ul className="space-y-0.5">
            {sec.items.map((it) => {
              const active = isActive(pathname, it.href)
              return (
                <li key={it.label}>
                  <Link href={it.href} onClick={onNavigate}
                    className={cn('flex items-center gap-3 rounded-xl px-3 transition-colors',
                      sec.emphasis === 'primary' ? 'py-2.5 text-[15px] font-bold' : sec.emphasis === 'secondary' ? 'py-2 text-sm font-semibold' : 'py-1.5 text-[13px] font-medium',
                      active ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white')}>
                    <it.icon className={cn(sec.emphasis === 'tertiary' ? 'h-4 w-4' : 'h-[18px] w-[18px]', !active && 'text-slate-400')} />
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.soon && <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400">em breve</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

const BOTTOM = [
  { href: '/', label: 'Início', Icon: LayoutDashboard },
  { href: '/eventos', label: 'Eventos', Icon: CalendarDays },
  { href: '/em-breve/pontos-fixos', label: 'Pontos Fixos', Icon: Briefcase },
  { href: '/financeiro/contas-a-pagar', label: 'Financeiro', Icon: Wallet },
]

function Frame({ children }: { children: ReactNode }) {
  const { tenant, email, signOut, env } = useEnvironment()
  const [menu, setMenu] = useState(false)
  const pathname = usePathname()
  const brand = (
    <div className="px-5 pb-2 pt-6">
      <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Gestão operacional</div>
      <div className="mt-0.5 text-lg font-black text-white">{tenant?.name}</div>
    </div>
  )
  const user = (
    <div className="border-t border-white/10 p-4">
      <div className="truncate text-xs text-slate-400">{email}</div>
      <button onClick={signOut} className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white"><LogOut className="h-3.5 w-3.5" />Sair</button>
    </div>
  )
  return (
    <div className="min-h-screen bg-slate-50 lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-slate-900 lg:flex">
        {brand}<SideNav />{user}
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
        <button className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMenu(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
        <div className="text-sm font-black text-slate-800 lg:hidden">{tenant?.name}</div>
        <div className="ml-auto"><AmbienteSwitcher /></div>
      </header>
      {env?.mode === 'consolidated' && (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-800 lg:px-8">
          Visão consolidada — somente consulta. Para criar ou alterar, escolha uma empresa.
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-5 lg:px-8 lg:pb-12">{children}</main>

      {menu && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 lg:hidden" onClick={() => setMenu(false)}>
          <div className="flex h-full w-80 max-w-[85%] flex-col bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">{brand}<button className="m-4 rounded-xl p-2 text-slate-400" onClick={() => setMenu(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></button></div>
            <SideNav onNavigate={() => setMenu(false)} />{user}
          </div>
        </div>
      )}

      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white lg:hidden">
        <ul className="flex">
          {BOTTOM.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href)
            return (
              <li key={href} className="flex-1">
                <Link href={href} className={cn('flex flex-col items-center gap-1 pt-2.5 text-[11px] font-semibold', active ? 'text-amber-600' : 'text-slate-400')}>
                  <Icon className="h-5 w-5" />{label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
