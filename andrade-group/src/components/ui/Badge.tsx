import { cn } from '@/lib/utils'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const map: Record<BadgeVariant, string> = {
  success: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-100  text-amber-700  ring-amber-200',
  danger:  'bg-red-100    text-red-700    ring-red-200',
  info:    'bg-blue-100   text-blue-700   ring-blue-200',
  neutral: 'bg-slate-100  text-slate-600  ring-slate-200',
}

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  dot?: boolean
}

export function Badge({ variant = 'neutral', children, className, dot }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1',
      map[variant],
      className
    )}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', {
        'bg-emerald-500': variant === 'success',
        'bg-amber-500':   variant === 'warning',
        'bg-red-500':     variant === 'danger',
        'bg-blue-500':    variant === 'info',
        'bg-slate-400':   variant === 'neutral',
      })} />}
      {children}
    </span>
  )
}
