import { NextRequest, NextResponse } from 'next/server'
import { isDemoModeServer } from '@/lib/demo/config'
import { execFrom, type FromRequest } from '@/lib/demo/query.server'
import { authGetUser, authSignIn, authSignOut, callRpc } from '@/lib/demo/rpcs.server'
import { storagePhotoDataUrl } from '@/lib/demo/store.server'

// Gateway único chamado pelo cliente-mock do navegador (src/lib/demo/mock-client.ts) no lugar do
// Supabase remoto. Só existe quando ERP_DEMO_MODE está ativo (ver src/lib/demo/config.ts).
const COOKIE = 'erp-demo-session'

type Body =
  | { op: 'from' } & FromRequest
  | { op: 'rpc'; name: string; args: Record<string, unknown> }
  | { op: 'auth'; action: 'signIn'; email: string; password: string }
  | { op: 'auth'; action: 'signOut' }
  | { op: 'auth'; action: 'getUser' }
  | { op: 'storage'; action: 'createSignedUrl'; path: string }

export async function POST(req: NextRequest) {
  if (!isDemoModeServer()) return NextResponse.json({ error: 'Modo demo desativado.' }, { status: 404 })
  const body = (await req.json()) as Body
  const sessionId = req.cookies.get(COOKIE)?.value ?? null

  if (body.op === 'from') {
    return NextResponse.json(execFrom(body))
  }

  if (body.op === 'rpc') {
    return NextResponse.json(callRpc(body.name, body.args ?? {}, { sessionId }))
  }

  if (body.op === 'storage') {
    const url = storagePhotoDataUrl(body.path)
    return NextResponse.json({ data: url ? { signedUrl: url } : null, error: null })
  }

  if (body.op === 'auth') {
    if (body.action === 'getUser') {
      const u = authGetUser(sessionId)
      return NextResponse.json({ data: { user: u ? { id: u.user_id, email: u.email } : null }, error: null })
    }
    if (body.action === 'signIn') {
      const res = authSignIn(body.email, body.password)
      if (!res) return NextResponse.json({ data: { user: null }, error: { message: 'Invalid login credentials' } })
      const response = NextResponse.json({ data: { user: { id: res.user.user_id, email: res.user.email } }, error: null })
      response.cookies.set(COOKIE, res.sessionId, { httpOnly: true, sameSite: 'lax', path: '/' })
      return response
    }
    if (body.action === 'signOut') {
      authSignOut(sessionId)
      const response = NextResponse.json({ error: null })
      response.cookies.delete(COOKIE)
      return response
    }
  }

  return NextResponse.json({ error: 'Operação não suportada.' }, { status: 400 })
}
