import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase())

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request Sheets scope at login time — tokens arrive in account.access_token
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/spreadsheets',
          ].join(' '),
          access_type: 'offline',  // get refresh_token
          prompt: 'consent',       // always show consent so refresh_token is returned
        },
      },
    }),
  ],

  callbacks: {
    // Persist OAuth tokens in the JWT so API routes can use them
    async jwt({ token, account }) {
      if (account) {
        token.access_token  = account.access_token
        token.refresh_token = account.refresh_token
        token.expires_at    = account.expires_at
      }
      return token
    },

    // Expose access_token and role in the session
    async session({ session, token }) {
      const email  = session.user?.email?.toLowerCase() ?? ''
      const isAdmin = ADMIN_EMAILS.length === 0 || ADMIN_EMAILS.includes(email)

      return {
        ...session,
        access_token: token.access_token as string | undefined,
        isAdmin,
      }
    },

    // Block non-admin emails from admin pages
    async signIn({ profile }) {
      const email = (profile?.email ?? '').toLowerCase()
      if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email)) {
        return false   // rejects the sign-in; NextAuth shows an error page
      }
      return true
    },
  },

  pages: {
    signIn: '/admin/login',
    error:  '/admin/login',
  },
})
