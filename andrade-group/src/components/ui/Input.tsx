import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helper?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helper, icon, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-2xl border bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent',
              'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
              'transition-shadow',
              error
                ? 'border-red-300 bg-red-50/30 focus:ring-red-400'
                : 'border-slate-200 hover:border-slate-300 shadow-sm',
              icon && 'pl-10',
              className
            )}
            {...props}
          />
        </div>
        {error  && <p className="text-xs text-red-500 flex items-center gap-1">⚠ {error}</p>}
        {helper && !error && <p className="text-xs text-slate-400">{helper}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
