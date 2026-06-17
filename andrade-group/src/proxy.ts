import { auth } from '@/auth'
import { NextResponse } from 'next/server'

const PROTECTED = ['/cadastrar-eventos', '/gerenciador']
const PUBLIC    = ['/gerenciador/login']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isPublic    = PUBLIC.some(p => pathname.startsWith(p))
  const isProtected = !isPublic && PROTECTED.some(p => pathname.startsWith(p))

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
