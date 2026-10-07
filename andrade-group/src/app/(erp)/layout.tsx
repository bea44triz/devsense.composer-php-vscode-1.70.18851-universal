import type { Metadata } from 'next'
import { ErpShell } from '@/components/erp/ErpShell'

export const metadata: Metadata = {
  title: 'Gestão Operacional',
  description: 'Eventos, equipes, presença e pontos fixos',
}

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  return <ErpShell>{children}</ErpShell>
}
