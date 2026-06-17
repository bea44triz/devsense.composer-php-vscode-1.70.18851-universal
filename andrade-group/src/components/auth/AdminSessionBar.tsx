import { auth, signOut } from '@/auth'
import { LogOut, UserCircle } from 'lucide-react'

export async function AdminSessionBar() {
  const session = await auth()
  if (!session?.user) return null

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center gap-3">
      {session.user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={session.user.image} alt="" className="w-7 h-7 rounded-full ring-1 ring-amber-400/40 shrink-0" />
      ) : (
        <UserCircle className="w-7 h-7 text-slate-400 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">{session.user.name}</p>
        <p className="text-[10px] text-slate-400 truncate">{session.user.email}</p>
      </div>

      <span className="hidden sm:inline text-[10px] text-emerald-400 font-semibold bg-emerald-400/10 px-2 py-0.5 rounded-full shrink-0">
        Gerenciador
      </span>

      <form
        action={async () => {
          'use server'
          await signOut({ redirectTo: '/gerenciador/login' })
        }}
      >
        <button type="submit"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white font-medium transition-colors p-1 rounded-lg hover:bg-white/10">
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </form>
    </div>
  )
}
