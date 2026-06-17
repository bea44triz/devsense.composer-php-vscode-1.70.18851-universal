import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  const paddings = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6' }
  return (
    <div className={cn(
      'bg-white rounded-2xl shadow-sm border border-slate-100',
      paddings[padding],
      className
    )}>
      {children}
    </div>
  )
}

export function CardSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</h2>
      {children}
    </div>
  )
}
