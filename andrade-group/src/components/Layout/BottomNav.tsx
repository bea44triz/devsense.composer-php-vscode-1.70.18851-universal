'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, UserCircle, PlusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/',                    label: 'Início',   Icon: Home         },
  { href: '/gerenciador/eventos', label: 'Eventos',  Icon: CalendarDays },
  { href: '/cadastrar-eventos',   label: 'Criar',    Icon: PlusCircle   },
  { href: '/perfil',              label: 'Perfil',   Icon: UserCircle   },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 shadow-[0_-1px_12px_rgba(0,0,0,0.08)]">
      <ul className="flex">
        {nav.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  'flex flex-col items-center gap-0.5 pt-3 pb-2 text-[10px] font-semibold tracking-wide transition-colors',
                  active ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <Icon
                  className={cn('w-6 h-6 transition-all', active && 'scale-110')}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
