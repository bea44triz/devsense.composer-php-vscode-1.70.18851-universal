import { auth }        from '@/auth'
import { redirect }    from 'next/navigation'
import { getEventoById } from '@/lib/google-sheets'
import { rowToEvento } from '@/app/api/eventos/route'
import { AppShell }    from '@/components/Layout/AppShell'
import { PageHeader }  from '@/components/Layout/PageHeader'
import { Card, CardSection } from '@/components/ui/Card'
import { LinkCopy }    from '@/components/ui/LinkCopy'
import { CalendarDays, Clock, MapPin, DollarSign, Users } from 'lucide-react'

const EQUIPE_LABELS: Record<string, string> = {
  brigadistas: 'Brigadistas',
  segurancas:  'Seguranças',
  limpeza:     'Limpeza',
}
const TIPO_LABELS: Record<string, string> = {
  coordenador: 'Coordenador',
  freelancer:  'Freelancer',
}

export default async function EventoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.managerId) redirect('/gerenciador/login')

  const { id }  = await params
  const row     = await getEventoById(id)
  if (!row) redirect('/gerenciador/eventos')
  const evento  = rowToEvento(row)

  const baseUrl = process.env.NEXTAUTH_URL ?? ''
  const dataFmt = new Intl.DateTimeFormat('pt-BR').format(new Date(evento.data + 'T12:00:00'))

  const regLinks = evento.equipes.filter(e => e.vagas > 0).map(e => ({
    label: `${EQUIPE_LABELS[e.equipe] ?? e.equipe} — ${TIPO_LABELS[e.tipo] ?? e.tipo} (${e.vagas} vagas)`,
    url:   `${baseUrl}/cadastro/${id}?equipe=${e.equipe}&tipo=${e.tipo}`,
  }))

  return (
    <AppShell>
      <PageHeader title={evento.titulo} subtitle="Detalhes do evento" backHref="/gerenciador/eventos" />

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-4">

        <Card>
          <CardSection title="Informações">
            <div className="space-y-2 text-sm">
              {[
                [<CalendarDays key="d" className="w-4 h-4 text-amber-500" />, `${dataFmt} · ${evento.horaInicio}–${evento.horaFim}`],
                [<MapPin       key="m" className="w-4 h-4 text-amber-500" />, `${evento.local} · ${evento.endereco}`],
                [<DollarSign   key="$" className="w-4 h-4 text-amber-500" />, `R$ ${evento.valorHora}/h`],
              ].map(([icon, text], i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="shrink-0 mt-0.5">{icon}</span>
                  <span className="text-slate-600">{text}</span>
                </div>
              ))}
              {evento.latitude && evento.longitude && (
                <a href={`https://maps.google.com/?q=${evento.latitude},${evento.longitude}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-amber-600 hover:underline text-xs font-semibold">
                  <MapPin className="w-3.5 h-3.5" /> Abrir localização GPS no Google Maps
                </a>
              )}
            </div>
          </CardSection>
        </Card>

        {regLinks.length > 0 && (
          <Card>
            <CardSection title="Links de Cadastro por Equipe">
              <p className="text-xs text-slate-400 -mt-1 mb-2">Envie o link correto para cada equipe</p>
              <div className="space-y-2">
                {regLinks.map(l => (
                  <LinkCopy key={l.url} label={l.label} url={l.url} />
                ))}
              </div>
            </CardSection>
          </Card>
        )}

        <Card>
          <CardSection title="Links de Presença">
            <p className="text-xs text-slate-400 -mt-1 mb-2">
              O coordenador envia esses links no dia do evento
            </p>
            <div className="space-y-2">
              <LinkCopy label="Check-in"  url={`${baseUrl}/checkin/${id}`}  />
              <LinkCopy label="Check-out" url={`${baseUrl}/checkout/${id}`} />
            </div>
          </CardSection>
        </Card>

        <Card>
          <CardSection title="Equipes">
            <div className="space-y-1.5">
              {evento.equipes.filter(e => e.vagas > 0).map(e => (
                <div key={`${e.equipe}_${e.tipo}`}
                  className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-slate-700 font-medium">
                      {EQUIPE_LABELS[e.equipe] ?? e.equipe} · {TIPO_LABELS[e.tipo] ?? e.tipo}
                    </span>
                  </div>
                  <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                    {e.vagasOcupadas}/{e.vagas}
                  </span>
                </div>
              ))}
            </div>
          </CardSection>
        </Card>
      </main>
    </AppShell>
  )
}
