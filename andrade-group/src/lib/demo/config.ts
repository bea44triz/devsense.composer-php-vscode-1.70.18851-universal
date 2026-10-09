// Modo demonstração: roda o ERP inteiro sem Supabase/Postgres/PostgREST, com dados locais resetáveis.
// Ativado só por `npm run dev:demo` (que define as duas variáveis abaixo antes de subir `next dev`).
// Trava dupla contra produção: mesmo que ERP_DEMO_MODE escape para um build de produção por engano,
// NODE_ENV==='production' sempre desliga o modo demo — nunca checar só a variável isoladamente.

/** Seguro para código de servidor (Route Handlers, server components). */
export function isDemoModeServer(): boolean {
  return process.env.ERP_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production'
}

/**
 * Seguro para código de navegador: `NEXT_PUBLIC_*` é inlined no bundle pelo Next em build/dev time.
 * Mantém a mesma trava de produção (o valor só é 'true' quando o processo do servidor rodou com
 * NODE_ENV!=='production' no momento em que o Next leu o env — `next dev` sempre é development).
 */
export function isDemoModeClient(): boolean {
  return process.env.NEXT_PUBLIC_ERP_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production'
}
