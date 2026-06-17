import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  backHref?: string
  className?: string
  actions?: React.ReactNode
  /** Render a large decorative gradient band (for top-level screens) */
  hero?: boolean
}

export function PageHeader({ title, subtitle, backHref, className, actions, hero }: PageHeaderProps) {
  if (hero) {
    return (
      <header className={cn(
        'relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-5 pt-12 pb-7',
        className
      )}>
        {/* Decorative amber blob */}
        <div className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-8 w-32 h-32 rounded-full bg-amber-400/10 blur-2xl" />
        <div className="relative">
          {backHref && (
            <Link href={backHref} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-3 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Voltar
            </Link>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
          {actions && <div className="mt-4">{actions}</div>}
        </div>
      </header>
    )
  }

  return (
    <header className={cn(
      'bg-white border-b border-slate-200 text-slate-900 px-4 py-4 sticky top-0 z-10',
      className
    )}>
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        {backHref && (
          <Link href={backHref} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors -ml-1">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-slate-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
