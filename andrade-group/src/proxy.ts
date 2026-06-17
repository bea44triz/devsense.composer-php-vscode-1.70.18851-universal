import { auth } from '@/auth'
import { NextResponse } from 'next/server'

const ADMIN_PATHS = ['/cadastrar-eventos', '/admin']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAdminPath  = ADMIN_PATHS.some(p => pathname.startsWith(p))

  if (isAdminPath) {
    const session = req.auth

    if (!session) {
      const loginUrl = new URL('/admin/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    if (!session.isAdmin) {
      return NextResponse.redirect(new URL('/admin/acesso-negado', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/cadastrar-eventos/:path*', '/admin/:path*'],
}
