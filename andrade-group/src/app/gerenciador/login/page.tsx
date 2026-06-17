import { signIn } from '@/auth'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ShieldCheck, ArrowRight, Users, CalendarDays, BarChart3 } from 'lucide-react'

interface Props {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}

const errorMessages: Record<string, string> = {
  OAuthSignin:   'Erro ao iniciar login com Google. Tente novamente.',
  OAuthCallback: 'Erro ao retornar do Google. Tente novamente.',
  OAuthCreateAccount: 'Não foi possível criar sua conta. Tente novamente.',
  default:       'Ocorreu um erro. Tente novamente.',
}

export default async function GerenciadorLoginPage({ searchParams }: Props) {
  const session = await auth()
  const params  = await searchParams

  if (session?.managerId) redirect(params.callbackUrl ?? '/cadastrar-eventos')

  const errorMsg = params.error
    ? (errorMessages[params.error] ?? errorMessages.default)
    : null

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Blobs decorativos */}
      <div className="pointer-events-none fixed -top-20 -right-20 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none fixed bottom-10 -left-10 w-56 h-56 rounded-full bg-amber-400/10 blur-2xl" />

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm space-y-8">

          {/* Logo */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-900/40 mb-4">
              <span className="text-white font-black text-xl">AG</span>
            </div>
            <h1 className="text-2xl font-black text-white">Andrade Group</h1>
            <p className="text-slate-400 text-sm mt-1">Portal do Gerenciador</p>
          </div>

          {/* Card principal */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-7 backdrop-blur-sm space-y-6">

            {/* O que o gerenciador pode fazer */}
            <div className="space-y-3">
              {[
                { Icon: CalendarDays, text: 'Criar e gerenciar eventos'     },
                { Icon: Users,        text: 'Acompanhar inscrições'          },
                { Icon: BarChart3,    text: 'Ver check-ins em tempo real'   },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-sm text-slate-300">{text}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10" />

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
                <p className="text-sm text-red-400">{errorMsg}</p>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Use sua conta Gmail para entrar. Se for seu primeiro acesso,
                sua conta será criada automaticamente.
              </p>

              {/* Server Action — sem JS no cliente */}
              <form
                action={async () => {
                  'use server'
                  await signIn('google', {
                    redirectTo: params.callbackUrl ?? '/cadastrar-eventos',
                  })
                }}
              >
                <button
                  type="submit"
                  className="w-full flex items-center gap-3 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-bold rounded-2xl px-5 py-4 transition-all active:scale-[0.98] shadow-sm"
                >
                  {/* Google "G" logo */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.8 33.7 29.4 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 6 1.1 8.2 3l5.7-5.7C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 19.5-7.3 21-17.3.2-1.2.3-2.4.3-3.7 0-1-.1-2-.3-4z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.6 18.9 13 24 13c3.1 0 6 1.1 8.2 3l5.7-5.7C34.5 5.1 29.5 3 24 3 16.3 3 9.6 7.9 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 45c5.3 0 10.2-1.9 13.9-5.1l-6.4-5.4C29.5 36.4 26.9 37 24 37c-5.3 0-9.8-3.3-11.4-8l-6.6 5.1C9.4 41 16.2 45 24 45z"/>
                    <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.7 2.5-2.3 4.7-4.4 6.2v.1l6.4 5.4C41.1 36.1 45 30.5 45 24c0-1-.1-2-.3-4h-.1z"/>
                  </svg>
                  <span className="flex-1 text-left">Entrar com Gmail</span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              </form>
            </div>
          </div>

          {/* Rodapé informativo */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="text-slate-300 font-semibold">Qualquer conta Gmail pode entrar.</span>{' '}
              Cada gerenciador tem acesso apenas aos eventos que criou.
              Os dados são salvos no Google Sheets da Andrade Group.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
