import { auth, signOut } from '@/auth'
import { CheckCircle2, LogOut } from 'lucide-react'

export async function AdminSessionBar() {
  const session = await auth()
  if (!session?.user) return null

  return (
    <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {session.user.image && (
        <img src={session.user.image} alt="" className="w-7 h-7 rounded-full ring-1 ring-emerald-200 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <p className="text-xs font-bold text-emerald-800 truncate">{session.user.email}</p>
        </div>
        <p className="text-[10px] text-emerald-600 font-medium">
          Google Sheets sincronizado ✓
        </p>
      </div>

      <form
        action={async () => {
          'use server'
          await signOut({ redirectTo: '/admin/login' })
        }}
      >
        <button type="submit" className="flex items-center gap-1 text-xs text-emerald-700 hover:text-red-600 font-semibold transition-colors">
          <LogOut className="w-3.5 h-3.5" />
          Sair
        </button>
      </form>
    </div>
  )
}
