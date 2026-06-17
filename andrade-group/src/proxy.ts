import { auth } from '@/auth'
import { NextResponse } from 'next/server'

// Rotas que exigem login de gerenciador
const PROTECTED = ['/cadastrar-eventos', '/gerenciador']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isProtected  = PROTECTED.some(p => pathname.startsWith(p))

  if (isProtected && !req.auth) {
    const loginUrl = new URL('/gerenciador/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/cadastrar-eventos/:path*', '/gerenciador/:path*'],
}
