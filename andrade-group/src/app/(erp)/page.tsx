'use client'
import Link from 'next/link'
import { AlertTriangle, CalendarPlus, ChevronRight, ClipboardCheck, LogIn, LogOut, UserCheck, Users } from 'lucide-react'
import { useEnvironment, useScope } from '@/lib/erp/environment'
import { useLoad } from '@/lib/erp/use-load'
import { brl, todayISO } from '@/lib/erp/ops'
import { eventStats, fetchEvents, fetchPayables, type EventRow } from '@/lib/erp/ops-data'
import { fetchFixedPosts } from '@/lib/erp/fixed-data'
import { FixedPostCard } from '@/components/erp/FixedPostCard'
import { EventCard } from '@/components/erp/EventCard'
import { EmptyState, ErrorBox, SectionTitle, Spinner } from '@/components/erp/ui'

const OPEN_PAYABLE = ['pendente_validacao', 'a_pagar', 'aprovado', 'agendado']

export default function HomePage() {
  const s = useScope()
  const { email } = useEnvironment()
  const key = s.ids.join(',')
  const events = useLoad(() => fetchEvents(s.ids), `ev:${key}`)
  const posts = useLoad(() => fetchFixedPosts(s.ids), `fp:${key}`)
  // contas a pagar só aparecem para quem tem permissão financeira (o RLS devolve vazio para os demais)
  const payables = useLoad(() => fetchPayables(s.ids).catch(() => []), `pay:${key}`)

  const today = todayISO()
  const all = events.data ?? []
  const active = all.filter((e) => e.status !== 'cancelado' && e.status !== 'fechado')
  const last = (e: EventRow) => e.end_date ?? e.event_date
  const todays = active.filter((e) => e.event_date <= today && last(e) >= today && e.status !== 'aguardando_fechamento')
  const upcoming = active.filter((e) => e.event_date > today).slice(0, 6)
  const toClose = active.filter((e) => e.status === 'aguardando_fechamento' || last(e) < today)

  const pend = pendencias(todays, active.filter((e) => last(e) >= today), toClose, today)
  const openPay = (payables.data ?? []).filter((p) => OPEN_PAYABLE.includes(p.status))
  const name = (email ?? '').split('@')[0]

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-400">Olá{name && `, ${name}`}</p>
          <h1 className="text-2xl font-black text-slate-900">Operação de hoje</h1>
        </div>
        {s.canOperate && (
          <Link href="/eventos/novo" className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-200 hover:bg-amber-400">
            <CalendarPlus className="h-4 w-4" /> Novo evento
          </Link>
        )}
      </div>

      {events.error && <ErrorBox>{events.error}</ErrorBox>}
      {events.loading ? <Spinner /> : (
        <>
          {todays.length === 0 ? (
            <EmptyState title="Nenhum evento hoje" text={upcoming[0] ? `Próximo: ${upcoming[0].name}` : 'Crie um evento para começar.'} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {todays.map((e) => <EventCard key={e.id} e={e} featured companyName={s.consolidated ? s.companyName(e.company_id) : undefined} />)}
            </div>
          )}

          <SectionTitle action={<Link href="/eventos" className="flex items-center text-xs font-bold text-amber-600">Ver todos<ChevronRight className="h-4 w-4" /></Link>}>Próximos eventos</SectionTitle>
          {upcoming.length === 0 ? <EmptyState title="Nenhum evento agendado" /> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((e) => <EventCard key={e.id} e={e} companyName={s.consolidated ? s.companyName(e.company_id) : undefined} />)}
            </div>
          )}

          <SectionTitle action={<Link href="/pontos-fixos" className="flex items-center text-xs font-bold text-amber-600">Ver todos<ChevronRight className="h-4 w-4" /></Link>}>Pontos Fixos</SectionTitle>
          {posts.loading ? <Spinner /> : (posts.data ?? []).filter((p) => p.status === 'ativo').length === 0 ? (
            <EmptyState title="Nenhum ponto fixo ativo" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(posts.data ?? []).filter((p) => p.status === 'ativo').slice(0, 6).map((p) => <FixedPostCard key={p.id} p={p} companyName={s.consolidated ? s.companyName(p.company_id) : undefined} />)}
            </div>
          )}

          <SectionTitle>Pendências operacionais</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <PendItem icon={Users} n={pend.vagas} text="vagas em aberto" />
            <PendItem icon={UserCheck} n={pend.aguardando} text="profissionais aguardando confirmação" />
            <PendItem icon={LogIn} n={pend.checkin} text="check-ins pendentes hoje" />
            <PendItem icon={LogOut} n={pend.checkout} text="check-outs pendentes hoje" />
            <PendItem icon={ClipboardCheck} n={pend.fechamento} text="eventos aguardando fechamento" href={toClose[0] ? `/eventos/${toClose[0].id}/fechamento` : undefined} />
          </div>

          {(payables.data ?? []).length > 0 && (
            <>
              <SectionTitle action={<Link href="/financeiro/contas-a-pagar" className="flex items-center text-xs font-bold text-amber-600">Contas a pagar<ChevronRight className="h-4 w-4" /></Link>}>Resumo financeiro</SectionTitle>
              <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                <span>A pagar: <b className="text-slate-800">{brl(openPay.reduce((a, p) => a + Number(p.amount), 0))}</b></span>
                <span>Lançamentos em aberto: <b className="text-slate-800">{openPay.length}</b></span>
                <span>Pendentes de validação: <b className="text-amber-700">{openPay.filter((p) => p.status === 'pendente_validacao').length}</b></span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function pendencias(todays: EventRow[], upcomingAndToday: EventRow[], toClose: EventRow[], today: string) {
  const sum = (list: EventRow[], f: (st: ReturnType<typeof eventStats>) => number) => list.reduce((a, e) => a + f(eventStats(e, today)), 0)
  return {
    vagas: sum(upcomingAndToday, (st) => st.open),
    aguardando: sum(upcomingAndToday, (st) => st.waiting),
    checkin: sum(todays, (st) => st.noShow),
    checkout: sum(todays, (st) => st.checkoutPending),
    fechamento: toClose.length,
  }
}

function PendItem({ icon: Icon, n, text, href }: { icon: typeof Users; n: number; text: string; href?: string }) {
  const body = (
    <div className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm ${n > 0 ? 'border-amber-200' : 'border-slate-100'}`}>
      {n > 0 ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" /> : <Icon className="h-4 w-4 shrink-0 text-slate-300" />}
      <span className={`text-lg font-black tabular-nums ${n > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{n}</span>
      <span className={`text-sm ${n > 0 ? 'text-slate-600' : 'text-slate-400'}`}>{text}</span>
    </div>
  )
  return href && n > 0 ? <Link href={href}>{body}</Link> : body
}
