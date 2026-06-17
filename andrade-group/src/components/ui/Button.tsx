'use client'
import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const base = [
      'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold',
      'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'active:scale-[0.97]',
    ].join(' ')

    const variants = {
      primary:   'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white shadow-md shadow-amber-200 focus-visible:ring-amber-400',
      secondary: 'bg-slate-800 hover:bg-slate-700 text-white shadow-sm focus-visible:ring-slate-500',
      danger:    'bg-red-500 hover:bg-red-600 text-white shadow-sm focus-visible:ring-red-400',
      ghost:     'hover:bg-slate-100 text-slate-700 focus-visible:ring-slate-300',
      outline:   'border-2 border-amber-400 text-amber-600 hover:bg-amber-50 focus-visible:ring-amber-400',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-sm h-8',
      md: 'px-5 py-2.5 text-sm h-10',
      lg: 'px-5 py-3.5 text-base h-13 w-full',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
