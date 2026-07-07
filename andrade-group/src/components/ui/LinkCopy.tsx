'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface LinkCopyProps {
  label: string
  url:   string
}

export function LinkCopy({ label, url }: LinkCopyProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-700">{label}</p>
        <p className="text-[10px] text-slate-400 truncate">{url}</p>
      </div>
      <button onClick={copy}
        className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors
          hover:bg-amber-50 text-amber-600 hover:text-amber-700">
        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  )
}
