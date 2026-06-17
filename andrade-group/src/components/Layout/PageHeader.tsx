import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  backHref?: string
  className?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, backHref, className, actions }: PageHeaderProps) {
  return (
    <header className={cn('bg-slate-900 text-white px-4 py-5 sticky top-0 z-10 shadow-lg', className)}>
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        {backHref && (
          <Link href={backHref} className="shrink-0 p-1 -ml-1 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
