import { NextResponse } from 'next/server'
import { isDemoModeServer } from '@/lib/demo/config'
import { resetStore } from '@/lib/demo/store.server'

/** Usado por `npm run dev:demo:reset` (scripts/dev-demo-reset.mjs). */
export async function POST() {
  if (!isDemoModeServer()) return NextResponse.json({ error: 'Modo demo desativado.' }, { status: 404 })
  resetStore()
  return NextResponse.json({ ok: true })
}
