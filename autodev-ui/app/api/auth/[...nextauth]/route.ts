import NextAuth from "next-auth"
import type { NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "atlassian",
      name: "Atlassian",
      type: "oauth",
      authorization: {
        url: "https://auth.atlassian.com/authorize",
        params: {
          audience: "api.atlassian.com",
          prompt: "consent",
          scope: "read:me read:account offline_access read:jira-work read:jira-user read:confluence-content.all read:confluence-user"
        }
      },
      token: "https://auth.atlassian.com/oauth/token",
      userinfo: {
        url: "https://api.atlassian.com/me",
        async request({ tokens }) {
          console.log('Fetching user info with token:', tokens.access_token?.substring(0, 20) + '...')
          const res = await fetch("https://api.atlassian.com/me", {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          })
          const data = await res.json()
          console.log('User info response:', data)
          return data
        }
      },
      profile(profile) {
        return {
          id: profile.account_id,
          name: profile.name,
          email: profile.email,
          image: profile.picture
        }
      },
      clientId: process.env.ATLASSIAN_CLIENT_ID,
      clientSecret: process.env.ATLASSIAN_CLIENT_SECRET,
    }
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      console.log('JWT Callback - Account:', account)
      console.log('JWT Callback - Profile:', profile)
      console.log('JWT Callback - Token before:', token)
      
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : Date.now() + 10 * 60 * 60 * 1000 // 10 hours
      }
      if (profile) {
        token.name = profile.name
        token.email = profile.email
        token.picture = profile.picture
      }
      
      console.log('JWT Callback - Token after:', token)
      return token
    },
    async session({ session, token }) {
      console.log('Session Callback - Token:', token)
      console.log('Session Callback - Session before:', session)
      
      session.accessToken = token.accessToken as string
      session.user = {
        name: token.name as string,
        email: token.email as string,
        image: token.picture as string,
      }
      
      console.log('Session Callback - Session after:', session)
      return session
    }
  },
  pages: {
    signIn: '/login',
    signOut: '/signout',
    error: '/login', // Redirect to login page on error
  },
  session: {
    strategy: "jwt",
    maxAge: 10 * 60 * 60, // 10 hours in seconds
  },
  debug: true, // Enable debug mode to see detailed error logs
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
