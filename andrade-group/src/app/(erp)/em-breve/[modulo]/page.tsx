'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Hammer } from 'lucide-react'
import { SOON } from '@/components/erp/nav'

export default function EmBrevePage() {
  const { modulo } = useParams<{ modulo: string }>()
  const m = SOON[modulo] ?? { title: 'Módulo', when: 'Próximos marcos', text: '' }
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Hammer className="h-6 w-6" /></div>
      <h1 className="mt-4 text-2xl font-black text-slate-900">{m.title}</h1>
      <p className="mt-1 text-xs font-bold uppercase tracking-widest text-amber-600">{m.when}</p>
      {m.text && <p className="mt-3 text-sm text-slate-500">{m.text}</p>}
      <Link href="/" className="mt-6 inline-block text-sm font-bold text-amber-600">Voltar para a operação</Link>
    </div>
  )
}
