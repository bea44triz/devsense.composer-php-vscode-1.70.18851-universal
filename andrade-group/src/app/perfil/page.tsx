'use client'
import { useState } from 'react'
import { AppShell } from '@/components/Layout/AppShell'
import { PageHeader } from '@/components/Layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  UserCircle, ChevronRight, ScanLine, CalendarDays,
  HelpCircle, LogOut, Hash, AlertCircle,
} from 'lucide-react'
import { formatCpf } from '@/lib/utils'
import Link from 'next/link'

export default function PerfilPage() {
  const [cpf, setCpf]             = useState('')
  const [loading, setLoading]     = useState(false)
  const [freelancer, setFreelancer] = useState<Record<string, string> | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [searched, setSearched]   = useState(false)

  const handleBuscar = async () => {
    const raw = cpf.replace(/\D/g, '')
    if (raw.length !== 11) { setError('CPF inválido.'); return }
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/freelancers?cpf=${raw}`)
      const data = await res.json()
      if (!res.ok || !data.data) throw new Error('Freelancer não encontrado.')
      setFreelancer(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
      setFreelancer(null)
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  const menuItems = [
    { href: '/checkinout',      Icon: ScanLine,    label: 'Fazer Check-in / Check-out' },
    { href: '/eventos',         Icon: CalendarDays, label: 'Ver eventos disponíveis'    },
    { href: '/cadastrar-dados', Icon: UserCircle,   label: 'Novo cadastro'              },
  ]

  return (
    <AppShell>
      <PageHeader title="Perfil" subtitle="Andrade Group" />

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-4">

        {/* Busca por CPF */}
        <Card className="animate-slide-up space-y-4">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Consultar cadastro</p>
            <p className="text-xs text-slate-500">Digite seu CPF para ver seus dados</p>
          </div>
          <Input label="CPF" placeholder="000.000.000-00" value={cpf}
            onChange={e => { setCpf(formatCpf(e.target.value)); setError(null) }}
            error={error ?? undefined} inputMode="numeric" />
          <Button onClick={handleBuscar} loading={loading} className="w-full">
            Buscar meu cadastro
          </Button>
        </Card>

        {/* Resultado */}
        {searched && !freelancer && !loading && (
          <div className="animate-slide-up flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-4">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Cadastro não encontrado</p>
              <p className="text-xs text-red-500 mt-0.5">
                Verifique o CPF ou{' '}
                <Link href="/cadastrar-dados" className="underline font-semibold">faça seu cadastro</Link>.
              </p>
            </div>
          </div>
        )}

        {freelancer && (
          <Card className="animate-slide-up space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <UserCircle className="w-8 h-8 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">{freelancer.nome}</p>
                <p className="text-xs text-slate-500">{freelancer.email}</p>
                <div className="mt-1">
                  <Badge variant={freelancer.status === 'ativo' ? 'success' : freelancer.status === 'pendente' ? 'warning' : 'neutral'} dot>
                    {freelancer.status}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-2">
              {[
                ['ID',       freelancer.id],
                ['Telefone', freelancer.telefone],
                ['PIX',      freelancer.pix],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">{k}</span>
                  <span className="font-mono font-semibold text-slate-700 truncate max-w-[60%] text-right">{v}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-3">
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Use seu ID no check-in dos eventos
              </p>
            </div>
          </Card>
        )}

        {/* Menu de ações */}
        <div className="animate-slide-up space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Ações rápidas</p>
          {menuItems.map(({ href, Icon, label }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98] group">
              <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-slate-600" />
              </div>
              <span className="flex-1 text-sm font-semibold text-slate-700">{label}</span>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
            </Link>
          ))}
        </div>

        {/* Rodapé */}
        <div className="text-center py-4 space-y-1">
          <p className="text-xs font-bold text-slate-800">Andrade Group</p>
          <p className="text-[11px] text-slate-400">v1.0 · suporte@andradegroup.com.br</p>
        </div>
      </main>
    </AppShell>
  )
}
