import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { getOrCreateGerenciador } from '@/lib/gerenciadores'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Apenas identidade — Sheets é acessado via service account, não pelo token do gerenciador
      authorization: {
        params: { scope: 'openid email profile' },
      },
    }),
  ],

  callbacks: {
    // Executado só no primeiro login (quando `account` está presente).
    // Registra o gerenciador na planilha se ainda não existir.
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        try {
          const gerenciador = await getOrCreateGerenciador({
            email: profile.email,
            nome:  (profile as { name?: string }).name ?? profile.email,
          })
          token.managerId     = gerenciador.id
          token.managerStatus = gerenciador.status
        } catch (err) {
          console.error('[auth] getOrCreateGerenciador failed:', err)
          // Allows login even if Sheets fails — managerId will be undefined
          // Check Vercel logs for the actual error message
        }
      }
      return token
    },

    async session({ session, token }) {
      return {
        ...session,
        managerId:     token.managerId as string,
        managerStatus: token.managerStatus as string,
      }
    },
  },

  pages: {
    signIn: '/gerenciador/login',
    error:  '/gerenciador/login',
  },
})
