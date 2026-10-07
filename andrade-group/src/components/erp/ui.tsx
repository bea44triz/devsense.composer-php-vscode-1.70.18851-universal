'use client'
// Peças visuais do ERP no estilo do app Andrade: cartões arredondados, slate + âmbar, mobile-first.
import { useState, type ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Check, Copy, Loader2, QrCode, Share2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateParts } from '@/lib/erp/ops'

export type Tone = 'muted' | 'info' | 'warning' | 'success' | 'danger'

const TONES: Record<Tone, string> = {
  muted:   'bg-slate-100 text-slate-600 ring-slate-200',
  info:    'bg-sky-100 text-sky-700 ring-sky-200',
  warning: 'bg-amber-100 text-amber-800 ring-amber-200',
  success: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  danger:  'bg-red-100 text-red-700 ring-red-200',
}

export function Pill({ tone = 'muted', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  )
}

export function Progress({ value, tone = 'warning', className }: { value: number; tone?: 'warning' | 'success' | 'danger'; className?: string }) {
  const bar = tone === 'success' ? 'bg-emerald-500' : tone === 'danger' ? 'bg-red-500' : 'bg-amber-500'
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

/** Bloco de data em destaque: 15 / OUT */
export function DateBlock({ date, size = 'md', dark }: { date: string; size?: 'md' | 'lg'; dark?: boolean }) {
  const { day, month } = dateParts(date)
  return (
    <div className={cn(
      'flex shrink-0 flex-col items-center justify-center rounded-2xl leading-none',
      dark ? 'bg-white/10 text-white' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
      size === 'lg' ? 'h-20 w-20' : 'h-16 w-16',
    )}>
      <span className={cn('font-black', size === 'lg' ? 'text-3xl' : 'text-2xl')}>{day}</span>
      <span className="mt-1 text-[11px] font-bold tracking-widest">{month}</span>
    </div>
  )
}

export function Stat({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: 'warning' | 'success' | 'danger'; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={cn('mt-1 text-2xl font-black tabular-nums text-slate-800',
        tone === 'warning' && 'text-amber-600', tone === 'success' && 'text-emerald-600', tone === 'danger' && 'text-red-600')}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-end justify-between gap-2 first:mt-0">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">{children}</h2>
      {action}
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
      <p className="font-bold text-slate-700">{title}</p>
      {text && <p className="mt-1 text-sm text-slate-400">{text}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin text-amber-500" /> {label ?? 'Carregando…'}
    </div>
  )
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{children}</p>
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string; badge?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 rounded-2xl bg-slate-100 p-1">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => onChange(t.key)}
            className={cn('flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
              value === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {t.label}
            {!!t.badge && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{t.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-black text-slate-800">{title}</h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Copiar, compartilhar (WhatsApp/apps do celular) e QR Code de um link. */
export function LinkActions({ url, title, compact }: { url: string; title: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* sem permissão */ }
  }
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title, url }) } catch { /* cancelado */ } } else copy()
  }
  const btn = 'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-amber-300 hover:text-amber-700'
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={copy} className={btn}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}{!compact && (copied ? 'Copiado' : 'Copiar link')}
        </button>
        <button type="button" onClick={share} className={btn} aria-label="Compartilhar"><Share2 className="h-3.5 w-3.5" />{!compact && 'Compartilhar'}</button>
        <button type="button" onClick={() => setQr(true)} className={btn} aria-label="QR Code"><QrCode className="h-3.5 w-3.5" />{!compact && 'QR Code'}</button>
      </div>
      <Modal open={qr} onClose={() => setQr(false)} title={title}>
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-4"><QRCodeSVG value={url} size={232} /></div>
          <code className="break-all text-center text-xs text-slate-400">{url}</code>
        </div>
      </Modal>
    </>
  )
}
